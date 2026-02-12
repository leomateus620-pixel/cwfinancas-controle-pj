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

// ============ Tab Router ============

const MONTH_NAMES_FULL: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const MONTH_NAMES_ABBR: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

type TabRoute = "DRE_ONLY" | "MONTHLY_TRANSACTIONS" | "IGNORE";

interface ClassifiedTab {
  title: string;
  route: TabRoute;
  monthIndex?: number;     // 1-12
  periodKey?: string;      // "YYYY-MM"
  inferredYear?: number;
}

function classifyTab(tabName: string, defaultYear: number): ClassifiedTab {
  const normalized = tabName.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // DRE check
  if (/^dre$/i.test(tabName.trim()) || normalized.includes("demonstracao") || normalized.includes("resultado")) {
    return { title: tabName, route: "DRE_ONLY" };
  }

  // Try full month names: "Janeiro", "Fevereiro 2025", "Junho/2025"
  for (const [name, idx] of Object.entries(MONTH_NAMES_FULL)) {
    const regex = new RegExp(`^${name}[\\s\\/\\-]*(\\d{2,4})?$`, "i");
    const match = normalized.match(regex);
    if (match) {
      const year = match[1] ? normalizeYear(match[1]) : defaultYear;
      return {
        title: tabName,
        route: "MONTHLY_TRANSACTIONS",
        monthIndex: idx,
        periodKey: `${year}-${String(idx).padStart(2, "0")}`,
        inferredYear: year,
      };
    }
  }

  // Try abbreviated: "Jan", "Fev/25", "Jun/2025", "ago./25"
  for (const [abbr, idx] of Object.entries(MONTH_NAMES_ABBR)) {
    const regex = new RegExp(`^${abbr}\\.?[\\s\\/\\-]*(\\d{2,4})?$`, "i");
    const match = normalized.match(regex);
    if (match) {
      const year = match[1] ? normalizeYear(match[1]) : defaultYear;
      return {
        title: tabName,
        route: "MONTHLY_TRANSACTIONS",
        monthIndex: idx,
        periodKey: `${year}-${String(idx).padStart(2, "0")}`,
        inferredYear: year,
      };
    }
  }

  return { title: tabName, route: "IGNORE" };
}

function normalizeYear(yearStr: string): number {
  const num = parseInt(yearStr);
  if (num >= 100) return num; // already 4-digit
  return num >= 50 ? 1900 + num : 2000 + num;
}

// ============ Utility functions (shared with google-sheets-sync) ============

function generateRowHash(content: Record<string, unknown>): string {
  const hash = createHash("md5");
  hash.update(JSON.stringify(content));
  return hash.digest("hex").slice(0, 12);
}

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

function parseBRL(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;

  let str = String(value).trim();
  if (!str) return null;

  // Reject dates
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  if (/^\d{1,2}[\/\-][a-zA-Záéíóúâêîôûãõ]+[\/\-]\d{2,4}$/i.test(str)) return null;
  if (/^[a-zA-Záéíóúâêîôûãõ]+[\/\-]\d{4}$/i.test(str)) return null;

  str = str.replace(/[R$¤€£¥a-zA-Z]/gi, "");
  str = str.replace(/[\u00A0\u2007\u202F\u200B\uFEFF]/g, "");
  str = str.replace(/\s+/g, "");

  if (!str || str === "-" || str === "+" || str === "--") return null;

  const isNegativeParens = str.startsWith("(") && str.endsWith(")");
  if (isNegativeParens) str = str.slice(1, -1);

  const isNegativePrefix = str.startsWith("-");
  const isNegativeSuffix = str.endsWith("-");
  str = str.replace(/^-+|-+$/g, "");

  if (!str) return null;

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;

  let normalized = str;

  if (lastComma > lastDot) {
    normalized = str.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = str.replace(/,/g, "");
  } else if (lastComma >= 0 && lastDot === -1) {
    if (commaCount === 1) {
      const afterComma = str.split(",")[1];
      normalized = afterComma && afterComma.length <= 2 ? str.replace(",", ".") : str.replace(",", "");
    } else {
      normalized = str.replace(/,/g, "");
    }
  } else if (lastDot >= 0 && lastComma === -1) {
    if (dotCount === 1) {
      const afterDot = str.split(".")[1];
      if (afterDot && afterDot.length === 3 && str.split(".")[0].length <= 3) {
        normalized = str.replace(".", "");
      }
    } else {
      normalized = str.replace(/\./g, "");
    }
  }

  const num = parseFloat(normalized);
  if (isNaN(num)) return null;

  const isNegative = isNegativeParens || isNegativePrefix || isNegativeSuffix;
  return isNegative ? -num : num;
}

function looksLikeDate(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return true;
  if (/^\d{1,2}[\/\-][a-zA-Záéíóúâêîôûãõ]+[\/\-]\d{2,4}$/i.test(str)) return true;
  return false;
}

function normalizeRowKeys(rowObj: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rowObj)) {
    normalized[key] = value;
    const trimmed = key.trim();
    if (trimmed !== key) normalized[trimmed] = value;
  }
  return normalized;
}

function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedColumnIndices = new Set<number>();

  const normalizedHeaders = headers.map(h =>
    (h || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  );

  const orderedPatterns: Array<[string, string[]]> = [
    ["date", ["data", "dt", "date", "vencimento", "competencia", "emissao", "lancado"]],
    ["description", ["descricao", "historico", "lancamento", "obs", "observacao", "memo", "detalhe", "detail", "description"]],
    ["amount", ["valor", "montante", "quantia", "vlr", "amount", "value"]],
    ["type", ["tipo", "natureza", "d/c", "entrada/saida", "type", "operacao"]],
    ["category", ["categoria", "classificacao", "grupo", "centro de custo", "category", "class"]],
    ["client_vendor", ["cliente", "fornecedor", "razao social", "empresa", "parceiro", "favorecido"]],
    ["credit", ["credito", "entrada", "receita", "credit", "recebido", "recebimento"]],
    ["debit", ["debito", "saida", "despesa", "debit", "pago", "pagamento"]],
  ];

  for (const [field, keywords] of orderedPatterns) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (usedColumnIndices.has(i)) continue;
      const header = normalizedHeaders[i];
      if (!header) continue;
      const matched = keywords.some(k => {
        if (header === k) return true;
        const regex = new RegExp(`\\b${k}\\b`);
        if (regex.test(header)) return true;
        if (header.startsWith(k) && k.length >= 3) return true;
        return false;
      });
      if (matched) {
        mapping[field] = headers[i];
        usedColumnIndices.add(i);
        break;
      }
    }
  }
  return mapping;
}

function extractAmount(
  rowObj: Record<string, unknown>,
  mapping: Record<string, string>
): { value: number | null; type: "income" | "expense" } {
  const nRow = normalizeRowKeys(rowObj);

  if (mapping.amount) {
    const raw = nRow[mapping.amount] ?? nRow[mapping.amount.trim()];
    if (raw !== null && raw !== undefined && !looksLikeDate(raw)) {
      const parsed = parseBRL(raw as string | number | null);
      if (parsed !== null) {
        if (mapping.type) {
          const typeRaw = nRow[mapping.type] ?? nRow[mapping.type.trim()];
          if (typeRaw) {
            const typeValue = String(typeRaw).toLowerCase().trim();
            if (["entrada", "receita", "credito", "crédito", "c", "r", "+"].some(k => typeValue.includes(k))) {
              return { value: Math.abs(parsed), type: "income" };
            }
            if (["saida", "saída", "despesa", "debito", "débito", "d", "-"].some(k => typeValue.includes(k))) {
              return { value: Math.abs(parsed), type: "expense" };
            }
          }
        }
        return { value: Math.abs(parsed), type: parsed >= 0 ? "income" : "expense" };
      }
    }
  }

  if (mapping.credit || mapping.debit) {
    const creditRaw = mapping.credit ? (nRow[mapping.credit] ?? nRow[mapping.credit.trim()]) : null;
    const debitRaw = mapping.debit ? (nRow[mapping.debit] ?? nRow[mapping.debit.trim()]) : null;
    if (looksLikeDate(creditRaw) || looksLikeDate(debitRaw)) return { value: null, type: "income" };
    const credit = parseBRL(creditRaw as string | number | null) || 0;
    const debit = parseBRL(debitRaw as string | number | null) || 0;
    if (credit > 0 && debit === 0) return { value: credit, type: "income" };
    if (debit > 0 && credit === 0) return { value: debit, type: "expense" };
    if (credit > 0 && debit > 0) {
      const net = credit - debit;
      return { value: Math.abs(net), type: net >= 0 ? "income" : "expense" };
    }
  }

  return { value: null, type: "income" };
}

function isSkippableRow(
  rowObj: Record<string, unknown>,
  description: string
): { skip: boolean; reason?: string } {
  const descLower = (description || "").toLowerCase().trim();
  const totalKeywords = ["total", "subtotal", "saldo", "soma", "acumulado", "resumo", "balanço", "balanco", "sum", "balance"];
  if (totalKeywords.some(k => descLower.includes(k))) return { skip: true, reason: "total_row" };

  const allValues = Object.values(rowObj).map(v => String(v || "").toLowerCase().trim());
  const headerKeywords = ["data", "date", "valor", "value", "descrição", "descricao", "description", "categoria", "category"];
  const headerMatchCount = headerKeywords.filter(k => allValues.some(v => v === k || v.includes(k))).length;
  if (headerMatchCount >= 2) return { skip: true, reason: "header_row" };

  const hasAnyContent = allValues.some(v => v && v.length > 0);
  if (!hasAnyContent) return { skip: true, reason: "empty" };

  return { skip: false };
}

function parseDate(value: string | number | null | undefined): string | null {
  if (!value) return null;

  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const serial = typeof value === "number" ? value : parseInt(String(value));
    if (serial > 25000 && serial < 60000) {
      const date = new Date((serial - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
    }
  }

  const str = String(value).trim();

  const brMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch.map(Number);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100)
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const brMatch2 = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (brMatch2) {
    const [, d, m] = brMatch2.map(Number);
    let y = parseInt(brMatch2[3]);
    y = y > 50 ? 1900 + y : 2000 + y;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12)
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  return null;
}

// ============ Main handler ============

interface SyncAllTabsRequest {
  connection_id: string;
  month_range?: { from: string; to: string }; // "YYYY-MM"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] sheets-sync-all-tabs started`);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    const body: SyncAllTabsRequest = await req.json();
    const { connection_id, month_range } = body;

    if (!connection_id) throw new Error("connection_id is required");

    console.log(`[${requestId}] User: ${userId}, Connection: ${connection_id}, Range: ${JSON.stringify(month_range)}`);

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from("google_sheet_connections")
      .select("*")
      .eq("id", connection_id)
      .eq("user_id", userId)
      .single();

    if (connError || !connection) throw new Error("Connection not found");

    // Refresh token if needed
    let accessToken = connection.access_token;
    const tokenExpired = !connection.token_expires_at || new Date(connection.token_expires_at) < new Date();
    if (tokenExpired || !accessToken) {
      console.log(`[${requestId}] Refreshing access token...`);
      const refreshed = await refreshAccessToken(connection.refresh_token);
      accessToken = refreshed.access_token;
      await supabase.from("google_sheet_connections").update({
        access_token: refreshed.access_token, token_expires_at: refreshed.expires_at,
      }).eq("id", connection_id);
    }

    // Update status
    await supabase.from("google_sheet_connections").update({ sync_status: "syncing" }).eq("id", connection_id);

    // Create sync log
    const { data: syncLog } = await supabase
      .from("google_sheet_sync_logs")
      .insert({ connection_id, status: "running", mode: "MANUAL" })
      .select().single();

    try {
      // 1. Get spreadsheet metadata (list of tabs)
      const metaResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!metaResponse.ok) throw new Error("Failed to fetch spreadsheet metadata");
      const metaData = await metaResponse.json();
      const allSheets: Array<{ properties: { title: string; sheetId: number; index: number } }> = metaData.sheets || [];

      console.log(`[${requestId}] Found ${allSheets.length} tabs: ${allSheets.map(s => s.properties.title).join(", ")}`);

      // 2. Classify each tab
      const defaultYear = new Date().getFullYear();
      const classified = allSheets.map(s => classifyTab(s.properties.title, defaultYear));

      // 3. Filter monthly tabs within range
      let monthlyTabs = classified.filter(t => t.route === "MONTHLY_TRANSACTIONS");

      if (month_range) {
        monthlyTabs = monthlyTabs.filter(t => {
          if (!t.periodKey) return false;
          return t.periodKey >= month_range.from && t.periodKey <= month_range.to;
        });
      }

      // Sort chronologically
      monthlyTabs.sort((a, b) => (a.periodKey || "").localeCompare(b.periodKey || ""));

      console.log(`[${requestId}] Monthly tabs to import: ${monthlyTabs.map(t => `${t.title} (${t.periodKey})`).join(", ")}`);

      if (monthlyTabs.length === 0) {
        throw new Error("Nenhuma aba mensal encontrada no intervalo selecionado");
      }

      // 4. Process each monthly tab
      const tabResults: Array<{ tab: string; periodKey: string; rowsImported: number; rowsSkipped: number; errors: number }> = [];
      let totalImported = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      const allErrors: Array<{ tab: string; row: number; error: string }> = [];

      for (const tab of monthlyTabs) {
        console.log(`[${requestId}] Processing tab: ${tab.title} (${tab.periodKey})`);

        // Fetch tab data
        const range = `'${tab.title}'!A1:Z1000`;
        const sheetsResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}/values/${encodeURIComponent(range)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!sheetsResponse.ok) {
          console.error(`[${requestId}] Failed to fetch tab ${tab.title}`);
          allErrors.push({ tab: tab.title, row: 0, error: "Failed to fetch tab data" });
          totalErrors++;
          tabResults.push({ tab: tab.title, periodKey: tab.periodKey || "", rowsImported: 0, rowsSkipped: 0, errors: 1 });
          continue;
        }

        const sheetsData = await sheetsResponse.json();
        const values: string[][] = sheetsData.values || [];

        if (values.length < 2) {
          console.log(`[${requestId}] Tab ${tab.title} has no data`);
          tabResults.push({ tab: tab.title, periodKey: tab.periodKey || "", rowsImported: 0, rowsSkipped: 0, errors: 0 });
          continue;
        }

        const headers = values[0];
        const rows = values.slice(1);

        // Auto-detect mapping for this tab
        const mapping = autoDetectMapping(headers);
        console.log(`[${requestId}] Tab ${tab.title} mapping:`, mapping);

        let tabImported = 0;
        let tabSkipped = 0;
        let tabErrors = 0;

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;

          try {
            const rowObj: Record<string, unknown> = {};
            headers.forEach((h, i) => { rowObj[h] = row[i] || ""; });

            const description = mapping.description
              ? String(rowObj[mapping.description] || "").trim()
              : "";

            const skipCheck = isSkippableRow(rowObj, description);
            if (skipCheck.skip) { tabSkipped++; continue; }

            const { value: amount, type } = extractAmount(rowObj, mapping);
            if (amount === null || amount === 0) { tabSkipped++; continue; }

            const dateRaw = mapping.date ? rowObj[mapping.date] : null;
            const date = parseDate(dateRaw as string | number | null);
            const finalDate = date || new Date().toISOString().split("T")[0];

            const category = mapping.category
              ? String(rowObj[mapping.category] || "").trim() || "Geral"
              : "Geral";
            const clientVendor = mapping.client_vendor
              ? String(rowObj[mapping.client_vendor] || "").trim() || null
              : null;

            // Idempotent key includes tab name
            const rowHash = generateRowHash({ description, amount, date: finalDate, type, category });
            const externalRowKey = `${tab.title}:${rowNumber}:${rowHash}`;

            const transactionData = {
              user_id: userId,
              description: description || "Sem descrição",
              amount,
              date: finalDate,
              type,
              category,
              client_vendor: clientVendor,
              notes: `Importado de: ${connection.spreadsheet_name} > ${tab.title}`,
              source: "sheets",
              source_sheet_id: connection_id,
              source_tab: tab.title,
              source_row_number: rowNumber,
              external_row_key: externalRowKey,
              raw_data: rowObj,
            };

            // Check existing
            const { data: existing } = await supabase
              .from("transactions")
              .select("id")
              .eq("user_id", userId)
              .eq("source_sheet_id", connection_id)
              .eq("external_row_key", externalRowKey)
              .maybeSingle();

            if (existing) {
              const { error: updateError } = await supabase
                .from("transactions")
                .update(transactionData)
                .eq("id", existing.id);
              if (updateError) {
                allErrors.push({ tab: tab.title, row: rowNumber, error: updateError.message });
                tabErrors++;
              } else {
                tabImported++;
              }
            } else {
              const { error: insertError } = await supabase
                .from("transactions")
                .insert(transactionData);
              if (insertError) {
                if (insertError.code === "23505") {
                  tabImported++; // race condition, already exists
                } else {
                  allErrors.push({ tab: tab.title, row: rowNumber, error: insertError.message });
                  tabErrors++;
                }
              } else {
                tabImported++;
              }
            }
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Unknown error";
            allErrors.push({ tab: tab.title, row: rowNumber, error: errMsg });
            tabErrors++;
          }
        }

        tabResults.push({
          tab: tab.title,
          periodKey: tab.periodKey || "",
          rowsImported: tabImported,
          rowsSkipped: tabSkipped,
          errors: tabErrors,
        });
        totalImported += tabImported;
        totalSkipped += tabSkipped;
        totalErrors += tabErrors;

        console.log(`[${requestId}] Tab ${tab.title}: imported=${tabImported}, skipped=${tabSkipped}, errors=${tabErrors}`);
      }

      // Final status
      const finalStatus = totalErrors > 0
        ? (totalImported > 0 ? "partial" : "error")
        : "success";

      // Update sync log
      if (syncLog) {
        await supabase.from("google_sheet_sync_logs").update({
          rows_processed: totalImported + totalSkipped + totalErrors,
          rows_imported: totalImported,
          rows_upserted: totalImported,
          rows_skipped: totalSkipped,
          errors: allErrors.slice(0, 50),
          completed_at: new Date().toISOString(),
          status: finalStatus,
        }).eq("id", syncLog.id);
      }

      // Update connection
      await supabase.from("google_sheet_connections").update({
        sync_status: finalStatus,
        last_sync_at: new Date().toISOString(),
      }).eq("id", connection_id);

      console.log(`[${requestId}] All tabs sync completed: tabs=${monthlyTabs.length}, imported=${totalImported}, skipped=${totalSkipped}, errors=${totalErrors}`);

      return new Response(
        JSON.stringify({
          success: true,
          tabs_imported: monthlyTabs.length,
          tab_results: tabResults,
          total_imported: totalImported,
          total_skipped: totalSkipped,
          total_errors: totalErrors,
          errors: allErrors.slice(0, 20),
          sync_run_id: syncLog?.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (syncError: unknown) {
      const msg = syncError instanceof Error ? syncError.message : "Unknown sync error";
      console.error(`[${requestId}] Sync error:`, msg);

      await supabase.from("google_sheet_connections").update({ sync_status: "error" }).eq("id", connection_id);
      if (syncLog) {
        await supabase.from("google_sheet_sync_logs").update({
          status: "error", errors: [{ message: msg }], completed_at: new Date().toISOString(),
        }).eq("id", syncLog.id);
      }
      throw syncError;
    }
  } catch (error: unknown) {
    console.error(`[${requestId}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
