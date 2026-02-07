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

/**
 * ROBUST Brazilian currency parser - handles ALL common formats
 * Returns null for empty/invalid values (NOT 0!)
 */
function parseBRL(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  
  let str = String(value).trim();
  if (!str) return null;
  
  // Remove currency symbols, letters, and whitespace
  str = str.replace(/[R$¤€£¥a-zA-Z]/gi, "");
  str = str.replace(/[\u00A0\u2007\u202F\u200B\uFEFF]/g, "");
  str = str.replace(/\s+/g, "");
  
  if (!str || str === "-" || str === "+") return null;
  
  // Detect negative by parentheses
  const isNegativeParens = str.startsWith("(") && str.endsWith(")");
  if (isNegativeParens) str = str.slice(1, -1);
  
  // Detect negative by prefix or suffix dash
  const isNegativePrefix = str.startsWith("-");
  const isNegativeSuffix = str.endsWith("-");
  str = str.replace(/^-+|-+$/g, "");
  
  if (!str) return null;
  
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  const commaCount = (str.match(/,/g) || []).length;
  
  let normalized = str;
  
  if (lastComma > lastDot) {
    normalized = str.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = str.replace(/,/g, "");
  } else if (lastComma >= 0 && lastDot === -1) {
    if (commaCount === 1) {
      const afterComma = str.split(",")[1];
      if (afterComma && afterComma.length <= 2) {
        normalized = str.replace(",", ".");
      } else {
        normalized = str.replace(",", "");
      }
    } else {
      normalized = str.replace(/,/g, "");
    }
  }
  
  const num = parseFloat(normalized);
  if (isNaN(num)) return null;
  
  const isNegative = isNegativeParens || isNegativePrefix || isNegativeSuffix;
  return isNegative ? -num : num;
}

/**
 * Parse date from various formats
 */
function parseDate(value: string | number | null | undefined): string | null {
  if (!value) return null;
  
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const serial = typeof value === "number" ? value : parseInt(String(value));
    if (serial > 25000 && serial < 60000) {
      const date = new Date((serial - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    }
  }
  
  const str = String(value).trim();
  
  const brMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (brMatch) {
    const day = parseInt(brMatch[1]);
    const month = parseInt(brMatch[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${brMatch[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return str;
  
  return null;
}

/**
 * Check if row should be skipped
 */
function isSkippableRow(description: string): { skip: boolean; reason?: string } {
  const descLower = (description || "").toLowerCase().trim();
  
  const totalKeywords = ["total", "subtotal", "saldo", "soma", "acumulado", "resumo"];
  if (totalKeywords.some(k => descLower.includes(k))) {
    return { skip: true, reason: "total_row" };
  }
  
  return { skip: false };
}

/**
 * Detect type from row data
 */
function detectType(row: Record<string, unknown>, mapping: Record<string, string>): "income" | "expense" {
  const typeCol = mapping.type;
  if (typeCol && row[typeCol]) {
    const typeValue = String(row[typeCol]).toLowerCase();
    if (typeValue.includes("entrada") || typeValue.includes("receita") || 
        typeValue.includes("credito") || typeValue.includes("crédito") || 
        typeValue === "c" || typeValue === "r") {
      return "income";
    }
    if (typeValue.includes("saida") || typeValue.includes("saída") || 
        typeValue.includes("despesa") || typeValue.includes("debito") ||
        typeValue.includes("débito") || typeValue === "d") {
      return "expense";
    }
  }
  
  // Check credit/debit columns
  if (mapping.credit || mapping.debit) {
    const credit = parseBRL(row[mapping.credit] as string | number | null) || 0;
    const debit = parseBRL(row[mapping.debit] as string | number | null) || 0;
    if (credit > debit) return "income";
    if (debit > credit) return "expense";
  }
  
  // Check amount sign
  const amountCol = mapping.amount;
  if (amountCol && row[amountCol]) {
    const amount = parseBRL(row[amountCol] as string | number | null);
    if (amount !== null && amount < 0) return "expense";
  }
  
  return "income";
}

/**
 * Extract amount supporting both single amount column and credit/debit
 */
function extractAmount(row: Record<string, unknown>, mapping: Record<string, string>): number | null {
  // Try credit/debit first
  if (mapping.credit || mapping.debit) {
    const credit = parseBRL(row[mapping.credit] as string | number | null) || 0;
    const debit = parseBRL(row[mapping.debit] as string | number | null) || 0;
    if (credit > 0 || debit > 0) {
      return Math.max(credit, debit);
    }
  }
  
  // Try amount column
  if (mapping.amount) {
    const amount = parseBRL(row[mapping.amount] as string | number | null);
    if (amount !== null) return Math.abs(amount);
  }
  
  return null;
}

/**
 * Auto-detect column mapping from headers
 */
function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map(h => 
    (h || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  );
  
  const patterns: Record<string, string[]> = {
    description: ["descricao", "historico", "lancamento", "obs", "observacao", "memo", "detalhe"],
    amount: ["valor", "montante", "quantia", "total", "vlr", "amount", "value", "r$"],
    date: ["data", "dt", "date", "vencimento", "competencia", "emissao"],
    type: ["tipo", "natureza", "d/c", "entrada/saida"],
    category: ["categoria", "classificacao", "grupo", "centro de custo", "category"],
    client_vendor: ["cliente", "fornecedor", "razao social", "empresa", "parceiro", "nome"],
    credit: ["credito", "entrada", "receita", "recebido"],
    debit: ["debito", "saida", "despesa", "pago"],
  };
  
  for (const [field, keywords] of Object.entries(patterns)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      if (keywords.some(k => header.includes(k) || header === k)) {
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
    const previewRows = rows.slice(0, 15).map((row, index) => {
      const rowObj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        rowObj[h] = row[i] || "";
      });

      const description = mapping.description ? String(rowObj[mapping.description] || "").trim() : "";
      const dateRaw = mapping.date ? rowObj[mapping.date] : null;
      const category = mapping.category ? String(rowObj[mapping.category] || "").trim() : "Geral";
      
      const amount = extractAmount(rowObj, mapping);
      const type = detectType(rowObj, mapping);
      const date = parseDate(dateRaw as string | number | null);
      const skipCheck = isSkippableRow(description);

      return {
        row_number: index + 2,
        original: rowObj,
        normalized: {
          description: description || "(sem descrição)",
          amount: amount !== null ? amount : null,
          amount_formatted: amount !== null 
            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
            : "(valor inválido)",
          date: date,
          date_formatted: date 
            ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR") 
            : "(data inválida)",
          type: type === "income" ? "Receita" : "Despesa",
          category: category || "Geral",
        },
        validation: {
          has_description: !!description,
          has_valid_amount: amount !== null && amount > 0,
          has_valid_date: !!date,
          is_skippable: skipCheck.skip,
          skip_reason: skipCheck.reason,
          is_valid: !!description && amount !== null && amount > 0,
        },
      };
    });

    // Calculate stats
    const validRows = previewRows.filter(r => r.validation.is_valid && !r.validation.is_skippable).length;
    const skippableRows = previewRows.filter(r => r.validation.is_skippable).length;
    const invalidRows = previewRows.filter(r => !r.validation.is_valid && !r.validation.is_skippable).length;
    const totalPreview = previewRows.length;

    return new Response(
      JSON.stringify({
        spreadsheet_name: connection.spreadsheet_name,
        sheet_name: connection.sheet_name,
        headers,
        detected_mapping: detectedMapping,
        current_mapping: mapping,
        mapping_confidence: Math.round(confidence * 100),
        has_credit_debit: !!(detectedMapping.credit || detectedMapping.debit),
        preview_rows: previewRows,
        total_rows: rows.length,
        preview_stats: {
          total: totalPreview,
          valid: validRows,
          skippable: skippableRows,
          invalid: invalidRows,
          estimated_import_rate: Math.round(((validRows + skippableRows) / totalPreview) * 100),
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
          credit: {
            current: mapping.credit || null,
            suggested: detectedMapping.credit || null,
            options: headers,
          },
          debit: {
            current: mapping.debit || null,
            suggested: detectedMapping.debit || null,
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
