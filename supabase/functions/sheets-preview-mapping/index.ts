import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface PreviewRequest {
  connection_id: string;
  custom_mapping?: Record<string, string>;
}

// Refresh access token
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: string }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh access token");
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  return { access_token: data.access_token, expires_at: expiresAt };
}

// Parse Brazilian currency format
function parseCurrency(value: string | number): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  
  let cleaned = value.toString().replace(/[R$\s]/g, "").trim();
  const hasBrazilianFormat = cleaned.includes(",") && (
    cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") || !cleaned.includes(".")
  );
  
  if (hasBrazilianFormat) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Parse date from various formats
function parseDate(value: string | number): string | null {
  if (!value) return null;
  
  if (typeof value === "number" || /^\d+$/.test(value.toString())) {
    const serial = typeof value === "number" ? value : parseInt(value);
    if (serial > 25000 && serial < 60000) {
      const date = new Date((serial - 25569) * 86400 * 1000);
      return date.toISOString().split("T")[0];
    }
  }
  
  const str = value.toString().trim();
  
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }
  
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return str;
  
  return null;
}

// Detect transaction type
function detectType(row: Record<string, unknown>, mapping: Record<string, string>): "income" | "expense" {
  const typeCol = mapping.type;
  if (typeCol && row[typeCol]) {
    const typeValue = String(row[typeCol]).toLowerCase();
    if (typeValue.includes("entrada") || typeValue.includes("receita") || 
        typeValue.includes("crédito") || typeValue === "c") {
      return "income";
    }
    if (typeValue.includes("saída") || typeValue.includes("despesa") || 
        typeValue.includes("débito") || typeValue === "d") {
      return "expense";
    }
  }
  
  const amountCol = mapping.amount;
  if (amountCol && row[amountCol]) {
    const amount = parseCurrency(row[amountCol] as string);
    if (amount < 0) return "expense";
  }
  
  return "income";
}

// Auto-detect column mapping from headers
function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lowerHeaders = headers.map(h => h?.toLowerCase().trim() || "");
  
  const patterns: Record<string, string[]> = {
    description: ["descrição", "descricao", "histórico", "historico", "lançamento", "lancamento", "obs", "observação", "memo"],
    amount: ["valor", "montante", "quantia", "total", "r$", "vlr", "amount", "value"],
    date: ["data", "dt", "date", "vencimento", "competência", "competencia", "emissão"],
    type: ["tipo", "natureza", "d/c", "entrada/saída", "entrada/saida"],
    category: ["categoria", "classificação", "classificacao", "grupo", "centro de custo", "category"],
    client_vendor: ["cliente", "fornecedor", "razão social", "empresa", "parceiro", "nome"],
  };
  
  for (const [field, keywords] of Object.entries(patterns)) {
    for (let i = 0; i < lowerHeaders.length; i++) {
      const header = lowerHeaders[i];
      if (keywords.some(k => header.includes(k))) {
        mapping[field] = headers[i];
        break;
      }
    }
  }
  
  return mapping;
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;
    const body: PreviewRequest = await req.json();
    const { connection_id, custom_mapping } = body;

    if (!connection_id) {
      throw new Error("connection_id is required");
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from("google_sheet_connections")
      .select("*")
      .eq("id", connection_id)
      .eq("user_id", userId)
      .single();

    if (connError || !connection) {
      throw new Error("Connection not found");
    }

    // Refresh access token if needed
    let accessToken = connection.access_token;
    const tokenExpired = !connection.token_expires_at || new Date(connection.token_expires_at) < new Date();
    
    if (tokenExpired || !accessToken) {
      const refreshed = await refreshAccessToken(connection.refresh_token);
      accessToken = refreshed.access_token;
      
      await supabase
        .from("google_sheet_connections")
        .update({
          access_token: refreshed.access_token,
          token_expires_at: refreshed.expires_at,
        })
        .eq("id", connection_id);
    }

    // Fetch sheet data
    const range = connection.sheet_name ? `'${connection.sheet_name}'` : "A:Z";
    const sheetsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}/values/${encodeURIComponent(range)}?majorDimension=ROWS`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!sheetsResponse.ok) {
      throw new Error("Failed to fetch sheet data");
    }

    const sheetsData = await sheetsResponse.json();
    const values: string[][] = sheetsData.values || [];

    if (values.length < 1) {
      throw new Error("Sheet is empty");
    }

    const headers = values[0];
    const rows = values.slice(1);

    // Auto-detect mapping or use provided
    const detectedMapping = autoDetectMapping(headers);
    const mapping = custom_mapping || connection.column_mapping || detectedMapping;

    // Calculate mapping confidence
    const requiredFields = ["description", "amount", "date"];
    const mappedFields = Object.keys(mapping);
    const confidence = requiredFields.filter(f => mappedFields.includes(f)).length / requiredFields.length;

    // Generate preview rows with normalized data
    const previewRows = rows.slice(0, 10).map((row, index) => {
      const rowObj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        rowObj[h] = row[i] || "";
      });

      // Normalize data using mapping
      const description = mapping.description ? String(rowObj[mapping.description] || "").trim() : "";
      const amountRaw = mapping.amount ? rowObj[mapping.amount] : 0;
      const dateRaw = mapping.date ? rowObj[mapping.date] : null;
      const category = mapping.category ? String(rowObj[mapping.category] || "").trim() : "Geral";
      const type = detectType(rowObj, mapping);

      const amount = parseCurrency(amountRaw as string);
      const date = parseDate(dateRaw as string | number);

      return {
        row_number: index + 2,
        original: rowObj,
        normalized: {
          description: description || "(sem descrição)",
          amount: Math.abs(amount),
          amount_formatted: new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(Math.abs(amount)),
          date: date,
          date_formatted: date 
            ? new Date(date).toLocaleDateString("pt-BR") 
            : "(data inválida)",
          type: type === "income" ? "Receita" : "Despesa",
          category: category || "Geral",
        },
        validation: {
          has_description: !!description,
          has_valid_amount: amount !== 0,
          has_valid_date: !!date,
          is_valid: !!description && amount !== 0 && !!date,
        },
      };
    });

    // Calculate stats
    const validRows = previewRows.filter(r => r.validation.is_valid).length;
    const totalPreview = previewRows.length;

    return new Response(
      JSON.stringify({
        spreadsheet_name: connection.spreadsheet_name,
        sheet_name: connection.sheet_name,
        headers,
        detected_mapping: detectedMapping,
        current_mapping: mapping,
        mapping_confidence: Math.round(confidence * 100),
        preview_rows: previewRows,
        total_rows: rows.length,
        preview_stats: {
          total: totalPreview,
          valid: validRows,
          invalid: totalPreview - validRows,
          validation_rate: Math.round((validRows / totalPreview) * 100),
        },
        field_suggestions: {
          description: {
            current: mapping.description || null,
            suggested: detectedMapping.description || null,
            options: headers,
          },
          amount: {
            current: mapping.amount || null,
            suggested: detectedMapping.amount || null,
            options: headers,
          },
          date: {
            current: mapping.date || null,
            suggested: detectedMapping.date || null,
            options: headers,
          },
          type: {
            current: mapping.type || null,
            suggested: detectedMapping.type || null,
            options: headers,
          },
          category: {
            current: mapping.category || null,
            suggested: detectedMapping.category || null,
            options: headers,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in sheets-preview-mapping:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
