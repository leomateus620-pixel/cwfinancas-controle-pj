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

const INTERNAL_TIMEOUT_MS = 110_000; // 110s - margin before Supabase 150s limit
const STALE_HEARTBEAT_MS = 2 * 60 * 1000; // 2 minutes

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
  monthIndex?: number;
  periodKey?: string;
  inferredYear?: number;
}

function classifyTab(tabName: string, defaultYear: number): ClassifiedTab {
  const normalized = tabName.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (/^dre$/i.test(tabName.trim()) || normalized.includes("demonstracao") || normalized.includes("resultado")) {
    return { title: tabName, route: "DRE_ONLY" };
  }

  for (const [name, idx] of Object.entries(MONTH_NAMES_FULL)) {
    const regex = new RegExp(`^${name}[\\s\\/\\-]*(\\d{2,4})?$`, "i");
    const match = normalized.match(regex);
    if (match) {
      const year = match[1] ? normalizeYear(match[1]) : defaultYear;
      return { title: tabName, route: "MONTHLY_TRANSACTIONS", monthIndex: idx, periodKey: `${year}-${String(idx).padStart(2, "0")}`, inferredYear: year };
    }
  }

  for (const [abbr, idx] of Object.entries(MONTH_NAMES_ABBR)) {
    const regex = new RegExp(`^${abbr}\\.?[\\s\\/\\-]*(\\d{2,4})?$`, "i");
    const match = normalized.match(regex);
    if (match) {
      const year = match[1] ? normalizeYear(match[1]) : defaultYear;
      return { title: tabName, route: "MONTHLY_TRANSACTIONS", monthIndex: idx, periodKey: `${year}-${String(idx).padStart(2, "0")}`, inferredYear: year };
    }
  }

  return { title: tabName, route: "IGNORE" };
}

function normalizeYear(yearStr: string): number {
  const num = parseInt(yearStr);
  if (num >= 100) return num;
  return num >= 50 ? 1900 + num : 2000 + num;
}

// ============ Utility functions ============

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

function extractAmount(rowObj: Record<string, unknown>, mapping: Record<string, string>): { value: number | null; type: "income" | "expense" } {
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
            if (["entrada", "receita", "credito", "crédito", "c", "r", "+"].some(k => typeValue.includes(k))) return { value: Math.abs(parsed), type: "income" };
            if (["saida", "saída", "despesa", "debito", "débito", "d", "-"].some(k => typeValue.includes(k))) return { value: Math.abs(parsed), type: "expense" };
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
    if (credit > 0 && debit > 0) { const net = credit - debit; return { value: Math.abs(net), type: net >= 0 ? "income" : "expense" }; }
  }
  return { value: null, type: "income" };
}

function isSkippableRow(rowObj: Record<string, unknown>, description: string): { skip: boolean; reason?: string } {
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

// ============ Job Control Helpers ============

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

async function checkAndClaimJob(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string,
  mode: string,
  requestId: string
): Promise<{ jobId: string } | { error: string; status: number }> {
  // Check for existing running jobs
  const { data: existingJobs } = await supabase
    .from("sheet_sync_jobs")
    .select("id, heartbeat_at, status")
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (existingJobs && existingJobs.length > 0) {
    const now = Date.now();
    for (const job of existingJobs) {
      const heartbeatAge = job.heartbeat_at ? now - new Date(job.heartbeat_at).getTime() : Infinity;
      if (heartbeatAge < STALE_HEARTBEAT_MS) {
        // Job is still alive
        console.log(`[${requestId}] Job ${job.id} is still running (heartbeat ${Math.round(heartbeatAge / 1000)}s ago)`);
        return { error: "already_running", status: 409 };
      } else {
        // Job is stale, mark as timeout
        console.log(`[${requestId}] Marking stale job ${job.id} as timeout (heartbeat ${Math.round(heartbeatAge / 1000)}s ago)`);
        await supabase.from("sheet_sync_jobs").update({
          status: "timeout",
          finished_at: new Date().toISOString(),
          error_message: "Job exceeded heartbeat timeout",
          error_step: "heartbeat_check",
        }).eq("id", job.id);
      }
    }
  }

  // Create new job
  const { data: newJob, error: jobError } = await supabase
    .from("sheet_sync_jobs")
    .insert({
      user_id: userId,
      connection_id: connectionId,
      mode,
      status: "running",
      started_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      progress: { tabs_total: 0, tabs_done: 0, rows_read: 0, rows_imported: 0, current_tab: "" },
      request_id: requestId,
    })
    .select("id")
    .single();

  if (jobError || !newJob) {
    console.error(`[${requestId}] Failed to create job:`, jobError);
    return { error: "Failed to create sync job", status: 500 };
  }

  console.log(`[${requestId}] Created job ${newJob.id}`);
  return { jobId: newJob.id };
}

async function updateJobHeartbeat(
  supabase: SupabaseClient,
  jobId: string,
  step: string,
  progress: Record<string, unknown>
): Promise<void> {
  await supabase.from("sheet_sync_jobs").update({
    heartbeat_at: new Date().toISOString(),
    progress,
    error_step: step,
  }).eq("id", jobId);
}

async function finalizeJob(
  supabase: SupabaseClient,
  jobId: string,
  status: string,
  errorMessage?: string,
  errorStep?: string,
  progress?: Record<string, unknown>
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    finished_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  };
  if (errorMessage) update.error_message = errorMessage;
  if (errorStep) update.error_step = errorStep;
  if (progress) update.progress = progress;

  await supabase.from("sheet_sync_jobs").update(update).eq("id", jobId);
}

// ============ Main handler ============

interface SyncAllTabsRequest {
  connection_id: string;
  month_range?: { from: string; to: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  console.log(`[${requestId}] sheets-sync-all-tabs started`);

  let jobId: string | null = null;
  let supabase: SupabaseClient;
  let connectionId: string | undefined;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    const body: SyncAllTabsRequest = await req.json();
    connectionId = body.connection_id;
    const { month_range } = body;

    if (!connectionId) throw new Error("connection_id is required");

    console.log(`[${requestId}] User: ${userId}, Connection: ${connectionId}, Range: ${JSON.stringify(month_range)}`);

    // ===== JOB CONTROL: Check concurrency & create job =====
    const jobResult = await checkAndClaimJob(supabase, userId, connectionId, "ALL_TABS", requestId);
    if ("error" in jobResult) {
      return new Response(JSON.stringify({ error: jobResult.error }), {
        status: jobResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    jobId = jobResult.jobId;

    // ===== STEP: auth =====
    await updateJobHeartbeat(supabase, jobId, "auth", { tabs_total: 0, tabs_done: 0, rows_read: 0, rows_imported: 0, current_tab: "Autenticando..." });

    const { data: connection, error: connError } = await supabase
      .from("google_sheet_connections").select("*").eq("id", connectionId).eq("user_id", userId).single();
    if (connError || !connection) throw new Error("Connection not found");

    let accessToken = connection.access_token;
    const tokenExpired = !connection.token_expires_at || new Date(connection.token_expires_at) < new Date();
    if (tokenExpired || !accessToken) {
      console.log(`[${requestId}] step=auth Refreshing token...`);
      const refreshed = await refreshAccessToken(connection.refresh_token);
      accessToken = refreshed.access_token;
      await supabase.from("google_sheet_connections").update({
        access_token: refreshed.access_token, token_expires_at: refreshed.expires_at,
      }).eq("id", connectionId);
    }
    console.log(`[${requestId}] step=auth OK`);

    await supabase.from("google_sheet_connections").update({ sync_status: "syncing" }).eq("id", connectionId);

    // Create sync log (legacy compatibility)
    const { data: syncLog } = await supabase
      .from("google_sheet_sync_logs")
      .insert({ connection_id: connectionId, status: "running", mode: "MANUAL" })
      .select().single();

    // ===== STEP: listTabs =====
    if (Date.now() - startTime > INTERNAL_TIMEOUT_MS) throw new Error("TIMEOUT_INTERNAL");
    await updateJobHeartbeat(supabase, jobId, "listTabs", { tabs_total: 0, tabs_done: 0, rows_read: 0, rows_imported: 0, current_tab: "Listando abas..." });

    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!metaResponse.ok) {
      const errText = await metaResponse.text();
      console.error(`[${requestId}] step=listTabs FAILED:`, errText);
      throw new Error(`Failed to fetch spreadsheet metadata: ${metaResponse.status}`);
    }
    const metaData = await metaResponse.json();
    const allSheets: Array<{ properties: { title: string; sheetId: number; index: number } }> = metaData.sheets || [];
    console.log(`[${requestId}] step=listTabs Found ${allSheets.length} tabs: ${allSheets.map(s => s.properties.title).join(", ")}`);

    // ===== STEP: classifyTabs =====
    if (Date.now() - startTime > INTERNAL_TIMEOUT_MS) throw new Error("TIMEOUT_INTERNAL");
    const defaultYear = new Date().getFullYear();
    const classified = allSheets.map(s => classifyTab(s.properties.title, defaultYear));
    let monthlyTabs = classified.filter(t => t.route === "MONTHLY_TRANSACTIONS");

    if (month_range) {
      monthlyTabs = monthlyTabs.filter(t => t.periodKey && t.periodKey >= month_range.from && t.periodKey <= month_range.to);
    }
    monthlyTabs.sort((a, b) => (a.periodKey || "").localeCompare(b.periodKey || ""));

    console.log(`[${requestId}] step=classifyTabs Monthly tabs: ${monthlyTabs.map(t => `${t.title}(${t.periodKey})`).join(", ")}`);

    await updateJobHeartbeat(supabase, jobId, "classifyTabs", {
      tabs_total: monthlyTabs.length, tabs_done: 0, rows_read: 0, rows_imported: 0,
      current_tab: `${monthlyTabs.length} abas mensais detectadas`,
    });

    if (monthlyTabs.length === 0) {
      throw new Error("Nenhuma aba mensal encontrada no intervalo selecionado");
    }

    // ===== STEP: process each tab =====
    const tabResults: Array<{ tab: string; periodKey: string; rowsImported: number; rowsSkipped: number; errors: number }> = [];
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const allErrors: Array<{ tab: string; row: number; error: string }> = [];

    for (let tabIdx = 0; tabIdx < monthlyTabs.length; tabIdx++) {
      const tab = monthlyTabs[tabIdx];

      // Timeout check
      if (Date.now() - startTime > INTERNAL_TIMEOUT_MS) {
        console.log(`[${requestId}] TIMEOUT_INTERNAL at tab ${tabIdx}/${monthlyTabs.length}`);
        await finalizeJob(supabase, jobId, "timeout", `Timeout after processing ${tabIdx} of ${monthlyTabs.length} tabs`, `readTab(${tab.title})`, {
          tabs_total: monthlyTabs.length, tabs_done: tabIdx, rows_read: totalImported + totalSkipped + totalErrors, rows_imported: totalImported, current_tab: tab.title,
        });
        jobId = null; // Prevent double-finalize
        // Still update sync log and connection
        if (syncLog) {
          await supabase.from("google_sheet_sync_logs").update({
            rows_processed: totalImported + totalSkipped + totalErrors, rows_imported: totalImported, rows_upserted: totalImported,
            rows_skipped: totalSkipped, errors: allErrors.slice(0, 50), completed_at: new Date().toISOString(), status: "partial",
          }).eq("id", syncLog.id);
        }
        await supabase.from("google_sheet_connections").update({ sync_status: "partial", last_sync_at: new Date().toISOString() }).eq("id", connectionId);

        return new Response(JSON.stringify({
          success: false, error: "timeout", tabs_imported: tabIdx, tab_results: tabResults,
          total_imported: totalImported, total_skipped: totalSkipped, total_errors: totalErrors, errors: allErrors.slice(0, 20),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[${requestId}] step=readTab(${tab.title}) [${tabIdx + 1}/${monthlyTabs.length}]`);
      await updateJobHeartbeat(supabase, jobId, `readTab(${tab.title})`, {
        tabs_total: monthlyTabs.length, tabs_done: tabIdx, rows_read: totalImported + totalSkipped + totalErrors, rows_imported: totalImported, current_tab: tab.title,
      });

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
        tabResults.push({ tab: tab.title, periodKey: tab.periodKey || "", rowsImported: 0, rowsSkipped: 0, errors: 0 });
        continue;
      }

      const headers = values[0];
      const rows = values.slice(1);
      const mapping = autoDetectMapping(headers);
      console.log(`[${requestId}] Tab ${tab.title} mapping: ${JSON.stringify(mapping)}`);

      let tabImported = 0;
      let tabSkipped = 0;
      let tabErrors = 0;

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const rowNumber = rowIndex + 2;
        try {
          const rowObj: Record<string, unknown> = {};
          headers.forEach((h, i) => { rowObj[h] = row[i] || ""; });
          const description = mapping.description ? String(rowObj[mapping.description] || "").trim() : "";
          const skipCheck = isSkippableRow(rowObj, description);
          if (skipCheck.skip) { tabSkipped++; continue; }
          const { value: amount, type } = extractAmount(rowObj, mapping);
          if (amount === null || amount === 0) { tabSkipped++; continue; }
          const dateRaw = mapping.date ? rowObj[mapping.date] : null;
          const date = parseDate(dateRaw as string | number | null);
          const finalDate = date || new Date().toISOString().split("T")[0];
          const category = mapping.category ? String(rowObj[mapping.category] || "").trim() || "Geral" : "Geral";
          const clientVendor = mapping.client_vendor ? String(rowObj[mapping.client_vendor] || "").trim() || null : null;
          const rowHash = generateRowHash({ description, amount, date: finalDate, type, category });
          const externalRowKey = `${tab.title}:${rowNumber}:${rowHash}`;
          const transactionData = {
            user_id: userId, description: description || "Sem descrição", amount, date: finalDate, type, category,
            client_vendor: clientVendor, notes: `Importado de: ${connection.spreadsheet_name} > ${tab.title}`,
            source: "sheets", source_sheet_id: connectionId, source_tab: tab.title,
            source_row_number: rowNumber, external_row_key: externalRowKey, raw_data: rowObj,
          };
          const { data: existing } = await supabase.from("transactions").select("id")
            .eq("user_id", userId).eq("source_sheet_id", connectionId).eq("external_row_key", externalRowKey).maybeSingle();
          if (existing) {
            const { error: updateError } = await supabase.from("transactions").update(transactionData).eq("id", existing.id);
            if (updateError) { allErrors.push({ tab: tab.title, row: rowNumber, error: updateError.message }); tabErrors++; }
            else { tabImported++; }
          } else {
            const { error: insertError } = await supabase.from("transactions").insert(transactionData);
            if (insertError) {
              if (insertError.code === "23505") { tabImported++; }
              else { allErrors.push({ tab: tab.title, row: rowNumber, error: insertError.message }); tabErrors++; }
            } else { tabImported++; }
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          allErrors.push({ tab: tab.title, row: rowNumber, error: errMsg });
          tabErrors++;
        }
      }

      tabResults.push({ tab: tab.title, periodKey: tab.periodKey || "", rowsImported: tabImported, rowsSkipped: tabSkipped, errors: tabErrors });
      totalImported += tabImported;
      totalSkipped += tabSkipped;
      totalErrors += tabErrors;
      console.log(`[${requestId}] Tab ${tab.title}: imported=${tabImported}, skipped=${tabSkipped}, errors=${tabErrors}`);
    }

    // ===== Finalize =====
    const finalStatus = totalErrors > 0 ? (totalImported > 0 ? "partial" : "error") : "success";

    if (syncLog) {
      await supabase.from("google_sheet_sync_logs").update({
        rows_processed: totalImported + totalSkipped + totalErrors, rows_imported: totalImported, rows_upserted: totalImported,
        rows_skipped: totalSkipped, errors: allErrors.slice(0, 50), completed_at: new Date().toISOString(), status: finalStatus,
      }).eq("id", syncLog.id);
    }

    await supabase.from("google_sheet_connections").update({ sync_status: finalStatus, last_sync_at: new Date().toISOString() }).eq("id", connectionId);

    // Finalize job as success
    await finalizeJob(supabase, jobId, finalStatus === "error" ? "failed" : "success", undefined, undefined, {
      tabs_total: monthlyTabs.length, tabs_done: monthlyTabs.length, rows_read: totalImported + totalSkipped + totalErrors, rows_imported: totalImported, current_tab: "Concluído",
    });
    jobId = null; // Prevent double-finalize

    console.log(`[${requestId}] All tabs sync completed: tabs=${monthlyTabs.length}, imported=${totalImported}, skipped=${totalSkipped}, errors=${totalErrors}, duration=${Date.now() - startTime}ms`);

    return new Response(JSON.stringify({
      success: true, tabs_imported: monthlyTabs.length, tab_results: tabResults,
      total_imported: totalImported, total_skipped: totalSkipped, total_errors: totalErrors, errors: allErrors.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = errorMessage === "TIMEOUT_INTERNAL";
    console.error(`[${requestId}] Error: ${errorMessage}`);

    // Finalize job if it exists
    if (jobId && supabase!) {
      try {
        await finalizeJob(supabase!, jobId, isTimeout ? "timeout" : "failed", errorMessage, "catch_block");
      } catch (e) {
        console.error(`[${requestId}] Failed to finalize job:`, e);
      }
    }

    // Update connection status
    if (connectionId && supabase!) {
      try {
        await supabase!.from("google_sheet_connections").update({ sync_status: "error" }).eq("id", connectionId);
      } catch (_e) { /* best effort */ }
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: isTimeout ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
