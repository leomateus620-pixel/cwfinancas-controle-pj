import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface ProfileRequest {
  connectionId: string;
  tabName?: string;
  forceRefresh?: boolean;
}

interface ColumnMapping {
  date?: string;
  description?: string;
  amount?: string;
  category?: string;
  type?: string;
  credit?: string;
  debit?: string;
  client_vendor?: string;
  account?: string;
}

interface ParsingRules {
  date_format: string;
  currency: string;
  negative_formats: string[];
  decimal_separator: string;
}

interface SkipPattern {
  type: "keyword" | "row_pattern";
  value?: string;
  description?: string;
}

// Generate a hash signature from headers
function generateHeaderSignature(headers: string[]): string {
  const normalized = headers
    .map(h => (h || "").trim().toLowerCase())
    .filter(h => h.length > 0)
    .sort()
    .join("|");
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `sig_${Math.abs(hash).toString(16)}_${headers.length}cols`;
}

// Deterministic column mapping based on common PT-BR synonyms
function deterministicMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map(h => 
    (h || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  );
  
  const patterns: Record<keyof ColumnMapping, string[]> = {
    date: ["data", "dt", "competencia", "vencimento", "emissao", "lancamento", "date"],
    description: ["descricao", "historico", "memo", "detalhe", "obs", "observacao", "description"],
    amount: ["valor", "montante", "total", "quantia", "amount", "vlr"],
    category: ["categoria", "classificacao", "grupo", "classe", "tipo despesa", "category"],
    type: ["tipo", "natureza", "d/c", "entrada/saida", "type"],
    credit: ["credito", "entrada", "receita", "credit", "c"],
    debit: ["debito", "saida", "despesa", "debit", "d"],
    client_vendor: ["cliente", "fornecedor", "razao social", "empresa", "pagador", "beneficiario"],
    account: ["conta", "banco", "account", "bank"],
  };
  
  for (const [field, keywords] of Object.entries(patterns)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      if (keywords.some(k => header.includes(k) || header === k)) {
        mapping[field as keyof ColumnMapping] = headers[i];
        break;
      }
    }
  }
  
  return mapping;
}

// Default parsing rules for Brazilian financial data
function defaultParsingRules(): ParsingRules {
  return {
    date_format: "DD/MM/YYYY",
    currency: "BRL",
    negative_formats: ["()", "-", "- R$", "R$ -"],
    decimal_separator: ",",
  };
}

// Default skip patterns
function defaultSkipPatterns(): SkipPattern[] {
  return [
    { type: "keyword", value: "total" },
    { type: "keyword", value: "subtotal" },
    { type: "keyword", value: "saldo" },
    { type: "keyword", value: "soma" },
    { type: "keyword", value: "acumulado" },
    { type: "row_pattern", description: "Linha com apenas números sem data válida" },
  ];
}

async function callAIForProfiling(
  headers: string[],
  sampleRows: Record<string, unknown>[],
): Promise<{
  column_mapping: ColumnMapping;
  parsing_rules: ParsingRules;
  skip_patterns: SkipPattern[];
  confidence: number;
}> {
  if (!LOVABLE_API_KEY) {
    // Fallback to deterministic
    return {
      column_mapping: deterministicMapping(headers),
      parsing_rules: defaultParsingRules(),
      skip_patterns: defaultSkipPatterns(),
      confidence: 0.7,
    };
  }

  // Prepare sample data (redact sensitive info)
  const redactedSample = sampleRows.slice(0, 50).map((row, idx) => {
    const redacted: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const strVal = String(value || "");
      // Keep structure but redact long text values
      if (strVal.length > 30) {
        redacted[key] = strVal.substring(0, 20) + "...";
      } else {
        redacted[key] = strVal;
      }
    }
    return { row_num: idx + 2, ...redacted };
  });

  const prompt = `Você é um especialista em análise de planilhas financeiras brasileiras.

CABEÇALHOS DA PLANILHA:
${JSON.stringify(headers)}

AMOSTRA DE DADOS (primeiras 50 linhas):
${JSON.stringify(redactedSample, null, 2)}

TAREFA:
Analise os cabeçalhos e a amostra para identificar:

1. MAPEAMENTO DE COLUNAS - Quais colunas correspondem a:
   - date: coluna de data do lançamento
   - description: descrição ou histórico
   - amount: valor único (se existir)
   - credit: coluna de crédito/entrada (se separada)
   - debit: coluna de débito/saída (se separada)
   - category: categoria ou classificação
   - type: tipo (receita/despesa)
   - client_vendor: cliente ou fornecedor
   - account: conta bancária

2. REGRAS DE PARSING:
   - date_format: formato de data (DD/MM/YYYY, YYYY-MM-DD, etc)
   - currency: moeda (BRL, USD)
   - negative_formats: como negativos aparecem ("()", "-R$", etc)
   - decimal_separator: separador decimal ("," ou ".")

3. PADRÕES DE SKIP - Quais padrões indicam linhas a ignorar:
   - Palavras-chave em descrição (total, saldo, etc)
   - Padrões de linha (cabeçalho repetido, linha vazia)

4. CONFIANÇA: De 0 a 1, quão confiante você está no mapeamento.

RESPONDA APENAS COM JSON VÁLIDO no formato:
{
  "column_mapping": {
    "date": "nome_exato_coluna",
    "description": "nome_exato_coluna",
    ...
  },
  "parsing_rules": {
    "date_format": "DD/MM/YYYY",
    "currency": "BRL",
    "negative_formats": ["()"],
    "decimal_separator": ","
  },
  "skip_patterns": [
    {"type": "keyword", "value": "total"},
    {"type": "row_pattern", "description": "..."}
  ],
  "confidence": 0.92
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em análise de planilhas financeiras. Responda APENAS com JSON válido, sem markdown ou texto adicional."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", response.status);
      return {
        column_mapping: deterministicMapping(headers),
        parsing_rules: defaultParsingRules(),
        skip_patterns: defaultSkipPatterns(),
        confidence: 0.6,
      };
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    // Clean markdown if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const parsed = JSON.parse(content);
    
    return {
      column_mapping: parsed.column_mapping || deterministicMapping(headers),
      parsing_rules: parsed.parsing_rules || defaultParsingRules(),
      skip_patterns: parsed.skip_patterns || defaultSkipPatterns(),
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.8)),
    };
  } catch (error) {
    console.error("Error calling AI:", error);
    return {
      column_mapping: deterministicMapping(headers),
      parsing_rules: defaultParsingRules(),
      skip_patterns: defaultSkipPatterns(),
      confidence: 0.5,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    const body: ProfileRequest = await req.json();
    const { connectionId, tabName, forceRefresh = false } = body;

    if (!connectionId) {
      return new Response(
        JSON.stringify({ error: "connectionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from("google_sheet_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", userId)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "Connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sourceTab = tabName || connection.sheet_name || "Sheet1";

    // Fetch sample data from Google Sheets
    const { data: oauthToken } = await supabase
      .from("google_oauth_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .single();

    if (!oauthToken) {
      return new Response(
        JSON.stringify({ error: "No Google OAuth token found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token if expired
    let accessToken = oauthToken.access_token;
    const expiresAt = new Date(oauthToken.expires_at).getTime();
    if (Date.now() >= expiresAt - 60000) {
      const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
      const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID || "",
          client_secret: GOOGLE_CLIENT_SECRET || "",
          refresh_token: oauthToken.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        accessToken = refreshData.access_token;
        const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
        await supabase.from("google_oauth_tokens").update({
          access_token: accessToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
      } else {
        console.error("Token refresh failed:", await refreshRes.text());
        return new Response(
          JSON.stringify({ error: "Google token expired. Please reconnect." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get sheet data (first 100 rows for profiling)
    const range = `'${sourceTab}'!A1:Z100`;
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}/values/${encodeURIComponent(range)}`;
    
    const sheetsResponse = await fetch(sheetsUrl, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!sheetsResponse.ok) {
      const errBody = await sheetsResponse.text();
      console.error("Google Sheets API error:", sheetsResponse.status, errBody);
      return new Response(
        JSON.stringify({ error: "Failed to fetch sheet data", details: errBody }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sheetsData = await sheetsResponse.json();
    const rows: string[][] = sheetsData.values || [];

    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ error: "Sheet has insufficient data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = rows[0].map(h => String(h || "").trim());
    const dataRows = rows.slice(1);
    const headerSignature = generateHeaderSignature(headers);

    // Check cache (unless forceRefresh)
    if (!forceRefresh) {
      const { data: existingProfile } = await supabase
        .from("ai_sheet_profiles")
        .select("*")
        .eq("user_id", userId)
        .eq("connected_sheet_id", connectionId)
        .eq("source_tab", sourceTab)
        .eq("header_signature", headerSignature)
        .gte("confidence", 0.85)
        .single();

      if (existingProfile) {
        return new Response(
          JSON.stringify({
            profile_id: existingProfile.id,
            header_signature: headerSignature,
            column_mapping: existingProfile.column_mapping,
            parsing_rules: existingProfile.parsing_rules,
            skip_patterns: existingProfile.skip_patterns,
            confidence: existingProfile.confidence,
            from_cache: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Convert rows to objects for AI analysis
    const sampleObjects = dataRows.map(row => {
      const obj: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        if (header) {
          obj[header] = row[idx] || "";
        }
      });
      return obj;
    });

    // Call AI for profiling (single call)
    const aiResult = await callAIForProfiling(headers, sampleObjects);

    // Upsert profile
    const { data: savedProfile, error: saveError } = await supabase
      .from("ai_sheet_profiles")
      .upsert({
        user_id: userId,
        connected_sheet_id: connectionId,
        source_tab: sourceTab,
        header_signature: headerSignature,
        column_mapping: aiResult.column_mapping,
        parsing_rules: aiResult.parsing_rules,
        skip_patterns: aiResult.skip_patterns,
        confidence: aiResult.confidence,
        ai_suggestions: aiResult,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,connected_sheet_id,source_tab,header_signature",
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving profile:", saveError);
    }

    return new Response(
      JSON.stringify({
        profile_id: savedProfile?.id || null,
        header_signature: headerSignature,
        column_mapping: aiResult.column_mapping,
        parsing_rules: aiResult.parsing_rules,
        skip_patterns: aiResult.skip_patterns,
        confidence: aiResult.confidence,
        from_cache: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in ai-profile-sheet:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
