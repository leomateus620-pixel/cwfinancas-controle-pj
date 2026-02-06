import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createHash } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface SyncRequest {
  connection_id: string;
  mode?: "MANUAL" | "SCHEDULED" | "PUSH";
  preview_only?: boolean;
  auto_detect?: boolean;
}

interface SyncResult {
  success: boolean;
  rows_read: number;
  rows_upserted: number;
  rows_updated: number;
  rows_failed: number;
  errors: Array<{ row: number; error: string }>;
  sync_run_id?: string;
}

// Generate a stable hash for row content
function generateRowHash(content: Record<string, unknown>): string {
  const hash = createHash("md5");
  hash.update(JSON.stringify(content));
  return hash.digest("hex").slice(0, 12);
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
    const errorText = await response.text();
    console.error("Token refresh failed:", errorText);
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
    const day = parseInt(brMatch[1]);
    const month = parseInt(brMatch[2]);
    if (day <= 31 && month <= 12) {
      return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
    }
  }
  
  // YYYY-MM-DD (ISO format)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return str;
  }
  
  return null;
}

// Detect transaction type
function detectType(row: Record<string, unknown>, mapping: Record<string, string>): "income" | "expense" {
  const typeCol = mapping.type;
  if (typeCol && row[typeCol]) {
    const typeValue = String(row[typeCol]).toLowerCase();
    if (typeValue.includes("entrada") || typeValue.includes("receita") || 
        typeValue.includes("crédito") || typeValue.includes("credito") || 
        typeValue === "c" || typeValue === "r") {
      return "income";
    }
    if (typeValue.includes("saída") || typeValue.includes("saida") || 
        typeValue.includes("despesa") || typeValue.includes("débito") || 
        typeValue.includes("debito") || typeValue === "d") {
      return "expense";
    }
  }
  
  // Check if amount is negative
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
    description: ["descrição", "descricao", "histórico", "historico", "lançamento", "lancamento", "obs", "observação", "observacao", "memo", "detail"],
    amount: ["valor", "montante", "quantia", "total", "r$", "vlr", "amount", "value"],
    date: ["data", "dt", "date", "vencimento", "competência", "competencia", "emissão", "emissao"],
    type: ["tipo", "natureza", "d/c", "entrada/saída", "entrada/saida", "type"],
    category: ["categoria", "classificação", "classificacao", "grupo", "centro", "centro de custo", "category"],
    client_vendor: ["cliente", "fornecedor", "razão social", "razao social", "empresa", "parceiro", "nome", "client", "vendor"],
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

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Sheets sync request started`);

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
    const body: SyncRequest = await req.json();
    const { connection_id, mode = "MANUAL", preview_only, auto_detect } = body;

    console.log(`[${requestId}] User: ${userId}, Connection: ${connection_id}, Mode: ${mode}`);

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
      console.error(`[${requestId}] Connection not found:`, connError);
      throw new Error("Connection not found");
    }

    // Refresh access token if needed
    let accessToken = connection.access_token;
    const tokenExpired = !connection.token_expires_at || new Date(connection.token_expires_at) < new Date();
    
    if (tokenExpired || !accessToken) {
      console.log(`[${requestId}] Refreshing access token...`);
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
        mode,
      })
      .select()
      .single();

    if (logError) {
      console.error(`[${requestId}] Failed to create sync log:`, logError);
    }

    try {
      // Fetch spreadsheet metadata to get revision
      const metaResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}?fields=properties.modifiedTime`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      let googleRevision: string | null = null;
      if (metaResponse.ok) {
        const metaData = await metaResponse.json();
        googleRevision = metaData.properties?.modifiedTime || null;
      }

      // Fetch sheet data
      const range = connection.sheet_name ? `'${connection.sheet_name}'` : "A:Z";
      const sheetsResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!sheetsResponse.ok) {
        const errorText = await sheetsResponse.text();
        console.error(`[${requestId}] Failed to fetch sheet data:`, errorText);
        throw new Error("Failed to fetch sheet data");
      }

      const sheetsData = await sheetsResponse.json();
      const values: string[][] = sheetsData.values || [];

      if (values.length < 2) {
        throw new Error("Sheet has no data or only headers");
      }

      const headers = values[0];
      const rows = values.slice(1);
      const tabName = connection.sheet_name || "Sheet1";

      console.log(`[${requestId}] Found ${rows.length} rows with headers: ${headers.join(", ")}`);

      // Auto-detect or use existing mapping
      let mapping = connection.column_mapping || {};
      if (auto_detect || Object.keys(mapping).length === 0) {
        mapping = autoDetectMapping(headers);
        console.log(`[${requestId}] Auto-detected mapping:`, mapping);
        
        await supabase
          .from("google_sheet_connections")
          .update({ column_mapping: mapping })
          .eq("id", connection_id);
      }

      // If preview only, return sample data
      if (preview_only) {
        const sampleRows = rows.slice(0, 5).map(row => {
          const obj: Record<string, unknown> = {};
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

      // Process rows with UPSERT for idempotency
      const result: SyncResult = {
        success: true,
        rows_read: 0,
        rows_upserted: 0,
        rows_updated: 0,
        rows_failed: 0,
        errors: [],
        sync_run_id: syncLog?.id,
      };

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const rowNumber = rowIndex + 2; // +2 because row 1 is headers, and we're 0-indexed
        result.rows_read++;
        
        try {
          // Create row object from headers
          const rowObj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            rowObj[h] = row[i] || "";
          });

          // Extract values using mapping
          const description = mapping.description ? String(rowObj[mapping.description] || "").trim() : "";
          const amountRaw = mapping.amount ? rowObj[mapping.amount] : 0;
          const dateRaw = mapping.date ? rowObj[mapping.date] : null;
          const category = mapping.category ? String(rowObj[mapping.category] || "").trim() : "Geral";
          const clientVendor = mapping.client_vendor ? String(rowObj[mapping.client_vendor] || "").trim() : null;

          // Skip empty rows
          if (!description && !amountRaw) {
            continue;
          }

          const amount = Math.abs(parseCurrency(amountRaw as string));
          const date = parseDate(dateRaw as string | number) || new Date().toISOString().split("T")[0];
          const type = detectType(rowObj, mapping);

          // Validate required fields
          if (amount === 0) {
            result.errors.push({ row: rowNumber, error: "Valor inválido ou zero" });
            result.rows_failed++;
            continue;
          }

          if (!date) {
            result.errors.push({ row: rowNumber, error: "Data inválida" });
            result.rows_failed++;
            continue;
          }

          // Generate idempotent key: tab:rowNumber:hash
          const rowHash = generateRowHash({
            description,
            amount,
            date,
            type,
            category,
          });
          const externalRowKey = `${tabName}:${rowNumber}:${rowHash}`;

          // UPSERT transaction
          const { data: existing, error: checkError } = await supabase
            .from("transactions")
            .select("id")
            .eq("user_id", userId)
            .eq("source_sheet_id", connection_id)
            .eq("external_row_key", externalRowKey)
            .maybeSingle();

          if (checkError) {
            console.error(`[${requestId}] Error checking existing:`, checkError);
          }

          const transactionData = {
            user_id: userId,
            description: description || "Sem descrição",
            amount,
            date,
            type,
            category: category || "Geral",
            client_vendor: clientVendor,
            notes: `Importado de: ${connection.spreadsheet_name}`,
            source: "sheets",
            source_sheet_id: connection_id,
            source_tab: tabName,
            source_row_number: rowNumber,
            external_row_key: externalRowKey,
            raw_data: rowObj,
          };

          if (existing) {
            // Update existing
            const { error: updateError } = await supabase
              .from("transactions")
              .update(transactionData)
              .eq("id", existing.id);

            if (updateError) {
              result.errors.push({ row: rowNumber, error: updateError.message });
              result.rows_failed++;
            } else {
              result.rows_updated++;
              result.rows_upserted++;
            }
          } else {
            // Insert new
            const { error: insertError } = await supabase
              .from("transactions")
              .insert(transactionData);

            if (insertError) {
              // Handle unique constraint violation (race condition)
              if (insertError.code === "23505") {
                result.rows_updated++;
                result.rows_upserted++;
              } else {
                result.errors.push({ row: rowNumber, error: insertError.message });
                result.rows_failed++;
              }
            } else {
              result.rows_upserted++;
            }
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          result.errors.push({ row: rowNumber, error: errMsg });
          result.rows_failed++;
        }
      }

      // Determine final status
      const finalStatus = result.rows_failed > 0 
        ? (result.rows_upserted > 0 ? "partial" : "error")
        : "success";

      // Update sync log
      if (syncLog) {
        await supabase
          .from("google_sheet_sync_logs")
          .update({
            rows_processed: result.rows_read,
            rows_imported: result.rows_upserted - result.rows_updated,
            rows_upserted: result.rows_upserted,
            rows_updated: result.rows_updated,
            rows_skipped: result.rows_failed,
            errors: result.errors.slice(0, 50),
            error_details: result.errors.length > 0 ? { errors: result.errors } : null,
            google_revision: googleRevision,
            completed_at: new Date().toISOString(),
            status: finalStatus,
          })
          .eq("id", syncLog.id);
      }

      // Update connection status
      await supabase
        .from("google_sheet_connections")
        .update({
          sync_status: finalStatus,
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", connection_id);

      console.log(`[${requestId}] Sync completed: ${JSON.stringify(result)}`);

      return new Response(
        JSON.stringify({
          success: true,
          ...result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (syncError: unknown) {
      const syncErrorMsg = syncError instanceof Error ? syncError.message : "Unknown sync error";
      console.error(`[${requestId}] Sync error:`, syncErrorMsg);

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
            error_details: { message: syncErrorMsg },
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLog.id);
      }

      throw syncError;
    }
  } catch (error: unknown) {
    console.error(`[${requestId}] Error in google-sheets-sync:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
