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
  
  // Remove currency symbols and spaces
  let cleaned = value.toString().replace(/[R$\s]/g, "").trim();
  
  // Handle Brazilian format (1.234,56) vs US format (1,234.56)
  const hasBrazilianFormat = cleaned.includes(",") && (
    cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ||
    !cleaned.includes(".")
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
  
  // Excel serial date
  if (typeof value === "number" || /^\d+$/.test(value.toString())) {
    const serial = typeof value === "number" ? value : parseInt(value);
    if (serial > 25000 && serial < 60000) {
      const date = new Date((serial - 25569) * 86400 * 1000);
      return date.toISOString().split("T")[0];
    }
  }
  
  const str = value.toString().trim();
  
  // DD/MM/YYYY (Brazilian format)
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }
  
  // YYYY-MM-DD (ISO format)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return str;
  }
  
  // MM/DD/YYYY (US format)
  const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    // Try to detect if it's US or BR format based on values
    const first = parseInt(usMatch[1]);
    const second = parseInt(usMatch[2]);
    if (first > 12) {
      // Must be DD/MM/YYYY
      return `${usMatch[3]}-${usMatch[2].padStart(2, "0")}-${usMatch[1].padStart(2, "0")}`;
    }
    // Assume MM/DD/YYYY if first <= 12
    return `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
  }
  
  return null;
}

// Detect transaction type
function detectType(row: Record<string, any>, mapping: Record<string, string>): "income" | "expense" {
  const typeCol = mapping.type;
  if (typeCol && row[typeCol]) {
    const typeValue = row[typeCol].toString().toLowerCase();
    if (typeValue.includes("entrada") || typeValue.includes("receita") || typeValue.includes("crédito") || typeValue === "c") {
      return "income";
    }
    if (typeValue.includes("saída") || typeValue.includes("despesa") || typeValue.includes("débito") || typeValue === "d") {
      return "expense";
    }
  }
  
  // Check if amount is negative
  const amountCol = mapping.amount;
  if (amountCol && row[amountCol]) {
    const amount = parseCurrency(row[amountCol]);
    if (amount < 0) return "expense";
  }
  
  return "income";
}

// Auto-detect column mapping from headers
function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lowerHeaders = headers.map(h => h?.toLowerCase().trim() || "");
  
  const patterns: Record<string, string[]> = {
    description: ["descrição", "descricao", "histórico", "historico", "lançamento", "lancamento", "obs", "observação"],
    amount: ["valor", "montante", "quantia", "total", "r$", "vlr"],
    date: ["data", "dt", "date", "vencimento", "competência", "competencia", "emissão"],
    type: ["tipo", "natureza", "d/c", "entrada/saída", "entrada/saida"],
    category: ["categoria", "classificação", "classificacao", "grupo", "centro", "centro de custo"],
    client_vendor: ["cliente", "fornecedor", "razão social", "razao social", "empresa", "parceiro"],
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
    // Get authorization header
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
    const body = await req.json();
    const { connection_id, preview_only, auto_detect } = body;

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
      
      // Update token in database
      await supabase
        .from("google_sheet_connections")
        .update({
          access_token: refreshed.access_token,
          token_expires_at: refreshed.expires_at,
        })
        .eq("id", connection_id);
    }

    // Update sync status
    await supabase
      .from("google_sheet_connections")
      .update({ sync_status: "syncing" })
      .eq("id", connection_id);

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from("google_sheet_sync_logs")
      .insert({
        connection_id,
        status: "running",
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create sync log:", logError);
    }

    try {
      // Fetch sheet data
      const range = connection.sheet_name ? `'${connection.sheet_name}'` : "A:Z";
      const sheetsResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}/values/${encodeURIComponent(range)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!sheetsResponse.ok) {
        throw new Error("Failed to fetch sheet data");
      }

      const sheetsData = await sheetsResponse.json();
      const values: string[][] = sheetsData.values || [];

      if (values.length < 2) {
        throw new Error("Sheet has no data or only headers");
      }

      const headers = values[0];
      const rows = values.slice(1);

      // Auto-detect or use existing mapping
      let mapping = connection.column_mapping || {};
      if (auto_detect || Object.keys(mapping).length === 0) {
        mapping = autoDetectMapping(headers);
        
        // Save auto-detected mapping
        await supabase
          .from("google_sheet_connections")
          .update({ column_mapping: mapping })
          .eq("id", connection_id);
      }

      // If preview only, return sample data
      if (preview_only) {
        const sampleRows = rows.slice(0, 5).map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            obj[h] = row[i] || "";
          });
          return obj;
        });

        await supabase
          .from("google_sheet_connections")
          .update({ sync_status: "pending" })
          .eq("id", connection_id);

        return new Response(
          JSON.stringify({
            headers,
            mapping,
            sample_rows: sampleRows,
            total_rows: rows.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Process rows
      let rowsProcessed = 0;
      let rowsImported = 0;
      let rowsSkipped = 0;
      const errors: any[] = [];

      for (const row of rows) {
        rowsProcessed++;
        
        try {
          // Create row object from headers
          const rowObj: Record<string, any> = {};
          headers.forEach((h, i) => {
            rowObj[h] = row[i] || "";
          });

          // Extract values using mapping
          const description = mapping.description ? rowObj[mapping.description]?.toString().trim() : "";
          const amountRaw = mapping.amount ? rowObj[mapping.amount] : 0;
          const dateRaw = mapping.date ? rowObj[mapping.date] : null;
          const category = mapping.category ? rowObj[mapping.category]?.toString().trim() : "Geral";
          const clientVendor = mapping.client_vendor ? rowObj[mapping.client_vendor]?.toString().trim() : null;

          if (!description && !amountRaw) {
            rowsSkipped++;
            continue;
          }

          const amount = Math.abs(parseCurrency(amountRaw));
          const date = parseDate(dateRaw) || new Date().toISOString().split("T")[0];
          const type = detectType(rowObj, mapping);

          // Insert transaction
          const { error: insertError } = await supabase
            .from("transactions")
            .insert({
              user_id: userId,
              description: description || "Sem descrição",
              amount,
              date,
              type,
              category: category || "Geral",
              client_vendor: clientVendor,
              notes: `Importado de: ${connection.spreadsheet_name}`,
            });

          if (insertError) {
            errors.push({ row: rowsProcessed, error: insertError.message });
            rowsSkipped++;
          } else {
            rowsImported++;
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          errors.push({ row: rowsProcessed, error: errMsg });
          rowsSkipped++;
        }
      }

      // Update sync log
      if (syncLog) {
        await supabase
          .from("google_sheet_sync_logs")
          .update({
            rows_processed: rowsProcessed,
            rows_imported: rowsImported,
            rows_skipped: rowsSkipped,
            errors: errors.slice(0, 50), // Limit errors stored
            completed_at: new Date().toISOString(),
            status: errors.length > 0 ? "partial" : "success",
          })
          .eq("id", syncLog.id);
      }

      // Update connection status
      await supabase
        .from("google_sheet_connections")
        .update({
          sync_status: errors.length > 0 ? "partial" : "success",
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", connection_id);

      return new Response(
        JSON.stringify({
          success: true,
          rows_processed: rowsProcessed,
          rows_imported: rowsImported,
          rows_skipped: rowsSkipped,
          errors: errors.slice(0, 10),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (syncError: unknown) {
      // Update status on error
      const syncErrorMsg = syncError instanceof Error ? syncError.message : "Unknown sync error";
      await supabase
        .from("google_sheet_connections")
        .update({ sync_status: "error" })
        .eq("id", connection_id);

      if (syncLog) {
        await supabase
          .from("google_sheet_sync_logs")
          .update({
            status: "error",
            errors: [{ message: syncErrorMsg }],
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLog.id);
      }

      throw syncError;
    }
  } catch (error: unknown) {
    console.error("Error in google-sheets-sync:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
