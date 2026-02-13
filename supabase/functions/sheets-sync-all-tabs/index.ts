import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createHash } from "https://deno.land/std@0.177.0/node/crypto.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const INTERNAL_TIMEOUT_MS = 110_000;
const STALE_HEARTBEAT_MS = 2 * 60 * 1000;
const BATCH_READ_SIZE = 500;
const BATCH_UPSERT_SIZE = 50;

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
  rowCount?: number;
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

// ============ Year Inference ============

function inferYearFromSpreadsheetName(name: string): number | null {
  const match = name.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

// ============ Utility functions ============

function generateRowHash(content: Record<string, unknown>): string {
  const hash = createHash("md5");
  hash.update(JSON.stringify(content));
  return hash.digest("hex").slice(0, 12);
}

// ============ XLSX Support ============
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function getFileMimeType(accessToken: string, fileId: string): Promise<{ mimeType: string; name: string }> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to get file info: ${res.status}`);
  return res.json();
}

async function downloadXlsxWorkbook(accessToken: string, fileId: string): Promise<any> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to download xlsx: ${res.status}`);
  const buffer = await res.arrayBuffer();
  return XLSX.read(new Uint8Array(buffer), { type: "array" });
}

function xlsxSheetToRows(workbook: any, sheetName?: string): string[][] {
  const target = sheetName || workbook.SheetNames[0];
  const ws = workbook.Sheets[target];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
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
    ["description", ["descricao", "historico", "lancamento", "obs", "observacao", "memo", "detalhe", "detail", "description", "fornecedor"]],
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

// RELAXED: only skip if NO valid date AND description has totalizing keyword, or if it's a repeated header row
function isSkippableRow(rowObj: Record<string, unknown>, description: string, hasValidDate: boolean): { skip: boolean; reason?: string } {
  const descLower = (description || "").toLowerCase().trim();
  
  // Header row detection: if >= 2 column values match known header keywords
  const allValues = Object.values(rowObj).map(v => String(v || "").toLowerCase().trim());
  const headerKeywords = ["data", "date", "valor", "value", "descrição", "descricao", "description", "categoria", "category"];
  const headerMatchCount = headerKeywords.filter(k => allValues.some(v => v === k || v.includes(k))).length;
  if (headerMatchCount >= 2) return { skip: true, reason: "header_row" };

  // Totalizing row: only skip if NO valid date (real transactions have dates)
  if (!hasValidDate) {
    const totalKeywords = ["total", "subtotal", "saldo", "soma", "acumulado", "resumo", "balanço", "balanco", "sum", "balance"];
    if (totalKeywords.some(k => descLower.includes(k))) return { skip: true, reason: "total_row" };
  }

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

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ============ Paginated Sheet Reading ============

async function readTabPaginated(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
  tabRowCount: number,
  requestId: string
): Promise<string[][]> {
  const allRows: string[][] = [];
  let startRow = 1;
  const maxRow = Math.min(tabRowCount, 10000); // safety cap

  while (startRow <= maxRow) {
    const endRow = Math.min(startRow + BATCH_READ_SIZE - 1, maxRow);
    const range = `'${tabTitle}'!A${startRow}:Z${endRow}`;
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.error(`[${requestId}] Failed to read range ${range}: ${response.status}`);
      break;
    }

    const data = await response.json();
    const values: string[][] = data.values || [];
    
    if (values.length === 0) break; // Empty batch = end of data
    
    allRows.push(...values);
    
    // If we got fewer rows than requested, we've reached the end
    if (values.length < BATCH_READ_SIZE) break;
    
    startRow = endRow + 1;
  }

  console.log(`[${requestId}] Tab "${tabTitle}": read ${allRows.length} total rows (rowCount hint: ${tabRowCount})`);
  return allRows;
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
        console.log(`[${requestId}] Job ${job.id} is still running (heartbeat ${Math.round(heartbeatAge / 1000)}s ago)`);
        return { error: "already_running", status: 409 };
      } else {
        console.log(`[${requestId}] Marking stale job ${job.id} as timeout`);
        await supabase.from("sheet_sync_jobs").update({
          status: "timeout", finished_at: new Date().toISOString(),
          error_message: "Job exceeded heartbeat timeout", error_step: "heartbeat_check",
        }).eq("id", job.id);
      }
    }
  }

  const { data: newJob, error: jobError } = await supabase
    .from("sheet_sync_jobs")
    .insert({
      user_id: userId, connection_id: connectionId, mode,
      status: "running", started_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(),
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
  supabase: SupabaseClient, jobId: string, step: string, progress: Record<string, unknown>
): Promise<void> {
  await supabase.from("sheet_sync_jobs").update({
    heartbeat_at: new Date().toISOString(), progress, error_step: step,
  }).eq("id", jobId);
}

async function finalizeJob(
  supabase: SupabaseClient, jobId: string, status: string,
  errorMessage?: string, errorStep?: string, progress?: Record<string, unknown>
): Promise<void> {
  const update: Record<string, unknown> = {
    status, finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(),
  };
  if (errorMessage) update.error_message = errorMessage;
  if (errorStep) update.error_step = errorStep;
  if (progress) update.progress = progress;
  await supabase.from("sheet_sync_jobs").update(update).eq("id", jobId);
}

// ============ Batch Upsert ============

interface TransactionRow {
  user_id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  category: string;
  client_vendor: string | null;
  notes: string;
  source: string;
  source_sheet_id: string;
  source_tab: string;
  source_row_number: number;
  external_row_key: string;
  raw_data: Record<string, unknown>;
  movement_type: string;
}

// ============ Transfer Detection ============

const TRANSFER_CATEGORY_KEYWORDS = [
  "transferência interna", "transferencia interna", "transferência", "transferencia",
  "aplicação", "aplicacao", "resgate", "aporte",
  "movimentação entre contas", "movimentacao entre contas",
];

function detectMovementType(category: string, description: string, type: string): string {
  const catLower = (category || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const descLower = (description || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Check category first (highest priority)
  for (const kw of TRANSFER_CATEGORY_KEYWORDS) {
    const kwNorm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (catLower.includes(kwNorm)) return "TRANSFER";
  }

  // Fallback: description keywords for inter-account transfers
  const transferDescKeywords = ["transferencia entre", "transf entre contas", "movimentacao entre"];
  for (const kw of transferDescKeywords) {
    const kwNorm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (descLower.includes(kwNorm)) return "TRANSFER";
  }

  return type === "income" ? "INCOME" : "EXPENSE";
}

async function batchUpsertTransactions(
  supabase: SupabaseClient,
  batch: TransactionRow[],
  userId: string,
  connectionId: string,
  requestId: string
): Promise<{ inserted: number; updated: number; errors: Array<{ row: number; error: string }> }> {
  if (batch.length === 0) return { inserted: 0, updated: 0, errors: [] };

  let inserted = 0;
  let updated = 0;
  const errors: Array<{ row: number; error: string }> = [];

  // Fetch existing keys in one query
  const batchKeys = batch.map(b => b.external_row_key);
  const existingSet = new Set<string>();
  
  // Query in chunks of 200 to avoid URL length limits
  for (const keyChunk of chunks(batchKeys, 200)) {
    const { data: existingRows } = await supabase
      .from("transactions")
      .select("external_row_key")
      .eq("user_id", userId)
      .eq("source_sheet_id", connectionId)
      .in("external_row_key", keyChunk);
    
    if (existingRows) {
      for (const row of existingRows) {
        if (row.external_row_key) existingSet.add(row.external_row_key);
      }
    }
  }

  const toInsert = batch.filter(b => !existingSet.has(b.external_row_key));
  const toUpdate = batch.filter(b => existingSet.has(b.external_row_key));

  // Insert in chunks
  for (const chunk of chunks(toInsert, BATCH_UPSERT_SIZE)) {
    const { error } = await supabase.from("transactions").insert(chunk);
    if (error) {
      // If batch fails, try one by one
      console.warn(`[${requestId}] Batch insert failed (${chunk.length} rows), falling back to individual: ${error.message}`);
      for (const row of chunk) {
        const { error: singleErr } = await supabase.from("transactions").insert(row);
        if (singleErr) {
          if (singleErr.code === "23505") { updated++; } // duplicate = already exists
          else { errors.push({ row: row.source_row_number, error: singleErr.message }); }
        } else { inserted++; }
      }
    } else {
      inserted += chunk.length;
    }
  }

  // Update in chunks using upsert
  for (const chunk of chunks(toUpdate, BATCH_UPSERT_SIZE)) {
    const { error } = await supabase.from("transactions").upsert(chunk, {
      onConflict: "user_id,source_sheet_id,external_row_key",
    });
    if (error) {
      console.warn(`[${requestId}] Batch upsert failed (${chunk.length} rows), falling back: ${error.message}`);
      for (const row of chunk) {
        const { error: singleErr } = await supabase.from("transactions")
          .update(row).eq("user_id", userId).eq("source_sheet_id", connectionId).eq("external_row_key", row.external_row_key);
        if (singleErr) { errors.push({ row: row.source_row_number, error: singleErr.message }); }
        else { updated++; }
      }
    } else {
      updated += chunk.length;
    }
  }

  return { inserted, updated, errors };
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

    // ===== JOB CONTROL =====
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
      const refreshed = await refreshAccessToken(connection.refresh_token);
      accessToken = refreshed.access_token;
      await supabase.from("google_sheet_connections").update({
        access_token: refreshed.access_token, token_expires_at: refreshed.expires_at,
      }).eq("id", connectionId);
    }

    await supabase.from("google_sheet_connections").update({ sync_status: "syncing" }).eq("id", connectionId);

    // Create sync log (legacy compatibility)
    const { data: syncLog } = await supabase
      .from("google_sheet_sync_logs")
      .insert({ connection_id: connectionId, status: "running", mode: "MANUAL" })
      .select().single();

    // ===== Detect file type =====
    const fileInfo = await getFileMimeType(accessToken!, connection.spreadsheet_id);
    const isXlsx = fileInfo.mimeType === XLSX_MIME;
    let xlsxWorkbook: any = null;
    if (isXlsx) {
      console.log(`[${requestId}] File is .xlsx, downloading and parsing...`);
      xlsxWorkbook = await downloadXlsxWorkbook(accessToken!, connection.spreadsheet_id);
    }

    // ===== STEP: listTabs with metadata (rowCount) =====
    if (Date.now() - startTime > INTERNAL_TIMEOUT_MS) throw new Error("TIMEOUT_INTERNAL");
    await updateJobHeartbeat(supabase, jobId, "listTabs", { tabs_total: 0, tabs_done: 0, rows_read: 0, rows_imported: 0, current_tab: "Listando abas..." });

    let spreadsheetTitle: string;
    let allSheets: Array<{ properties: { title: string; sheetId: number; index: number; gridProperties?: { rowCount?: number } } }>;

    if (xlsxWorkbook) {
      spreadsheetTitle = fileInfo.name || "";
      allSheets = xlsxWorkbook.SheetNames.map((name: string, idx: number) => {
        const sheetRows = xlsxSheetToRows(xlsxWorkbook, name);
        return {
          properties: {
            title: name,
            sheetId: idx,
            index: idx,
            gridProperties: { rowCount: sheetRows.length || 100 },
          },
        };
      });
    } else {
      const metaResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}?fields=properties.title,sheets.properties`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!metaResponse.ok) {
        const errText = await metaResponse.text();
        throw new Error(`Failed to fetch spreadsheet metadata: ${metaResponse.status} - ${errText}`);
      }
      const metaData = await metaResponse.json();
      spreadsheetTitle = metaData.properties?.title || "";
      allSheets = metaData.sheets || [];
    }
    console.log(`[${requestId}] Spreadsheet: "${spreadsheetTitle}", Found ${allSheets.length} tabs`);

    // ===== Year inference =====
    const inferredYear = inferYearFromSpreadsheetName(spreadsheetTitle);
    const defaultYear = inferredYear || new Date().getFullYear();
    console.log(`[${requestId}] Year inference: spreadsheet="${spreadsheetTitle}" -> ${inferredYear || "not found"}, using ${defaultYear}`);

    // ===== STEP: classifyTabs =====
    if (Date.now() - startTime > INTERNAL_TIMEOUT_MS) throw new Error("TIMEOUT_INTERNAL");
    const classified = allSheets.map(s => {
      const tab = classifyTab(s.properties.title, defaultYear);
      tab.rowCount = s.properties.gridProperties?.rowCount || 1000;
      return tab;
    });
    let monthlyTabs = classified.filter(t => t.route === "MONTHLY_TRANSACTIONS");

    if (month_range) {
      // Compare by month only (MM part) to avoid year mismatch between
      // the UI's date range (e.g. 2026-04) and the spreadsheet's inferred year (e.g. 2025-04)
      const rangeFromMonth = month_range.from.slice(-2); // "04"
      const rangeToMonth = month_range.to.slice(-2);     // "12"
      monthlyTabs = monthlyTabs.filter(t => {
        if (!t.periodKey || !t.monthIndex) return false;
        const tabMonth = String(t.monthIndex).padStart(2, "0");
        return tabMonth >= rangeFromMonth && tabMonth <= rangeToMonth;
      });
    }
    monthlyTabs.sort((a, b) => (a.periodKey || "").localeCompare(b.periodKey || ""));

    console.log(`[${requestId}] Monthly tabs: ${monthlyTabs.map(t => `${t.title}(${t.periodKey},rows=${t.rowCount})`).join(", ")}`);

    await updateJobHeartbeat(supabase, jobId, "classifyTabs", {
      tabs_total: monthlyTabs.length, tabs_done: 0, rows_read: 0, rows_imported: 0,
      current_tab: `${monthlyTabs.length} abas mensais detectadas`,
    });

    if (monthlyTabs.length === 0) {
      throw new Error("Nenhuma aba mensal encontrada no intervalo selecionado");
    }

    // ===== STEP: process each tab =====
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let totalScanned = 0;
    let totalWithValue = 0;
    const allErrors: Array<{ tab: string; row: number; error: string }> = [];

    for (let tabIdx = 0; tabIdx < monthlyTabs.length; tabIdx++) {
      const tab = monthlyTabs[tabIdx];

      // Timeout check
      if (Date.now() - startTime > INTERNAL_TIMEOUT_MS) {
        console.log(`[${requestId}] TIMEOUT at tab ${tabIdx}/${monthlyTabs.length}`);
        await finalizeJob(supabase, jobId, "timeout", `Timeout after ${tabIdx} of ${monthlyTabs.length} tabs`, `readTab(${tab.title})`, {
          tabs_total: monthlyTabs.length, tabs_done: tabIdx, rows_read: totalScanned, rows_imported: totalImported, current_tab: tab.title,
        });
        jobId = null;
        if (syncLog) {
          await supabase.from("google_sheet_sync_logs").update({
            rows_processed: totalScanned, rows_imported: totalImported, rows_upserted: totalImported,
            rows_skipped: totalSkipped, errors: allErrors.slice(0, 50), completed_at: new Date().toISOString(), status: "partial",
          }).eq("id", syncLog.id);
        }
        await supabase.from("google_sheet_connections").update({ sync_status: "partial", last_sync_at: new Date().toISOString() }).eq("id", connectionId);

        return new Response(JSON.stringify({
          success: false, error: "timeout", tabs_imported: tabIdx,
          total_imported: totalImported, total_skipped: totalSkipped, total_errors: totalErrors,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[${requestId}] Processing tab ${tab.title} [${tabIdx + 1}/${monthlyTabs.length}] (rowCount=${tab.rowCount})`);
      await updateJobHeartbeat(supabase, jobId, `readTab(${tab.title})`, {
        tabs_total: monthlyTabs.length, tabs_done: tabIdx, rows_read: totalScanned, rows_imported: totalImported, current_tab: tab.title,
      });

      // ===== PAGINATED READ =====
      const allRows = xlsxWorkbook
        ? xlsxSheetToRows(xlsxWorkbook, tab.title)
        : await readTabPaginated(accessToken!, connection.spreadsheet_id, tab.title, tab.rowCount || 1000, requestId);

      if (allRows.length < 2) {
        // Save empty audit
        await supabase.from("sync_tab_audit").insert({
          job_id: jobId, user_id: userId, connection_id: connectionId,
          tab_name: tab.title, period_key: tab.periodKey || null,
          rows_scanned: 0, rows_with_value: 0, rows_imported: 0, rows_skipped: 0,
          skip_reasons: { empty_tab: 1 }, errors: [],
        });
        continue;
      }

      const headers = allRows[0];
      const dataRows = allRows.slice(1);
      const mapping = autoDetectMapping(headers);
      console.log(`[${requestId}] Tab ${tab.title}: ${dataRows.length} data rows, mapping: ${JSON.stringify(mapping)}`);

      // ===== Parse all rows into batch =====
      const batch: TransactionRow[] = [];
      const skipReasons: Record<string, number> = {};
      let tabScanned = 0;
      let tabWithValue = 0;
      let tabSkipped = 0;

      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
        const row = dataRows[rowIndex];
        const rowNumber = rowIndex + 2; // 1-indexed, +1 for header
        tabScanned++;

        try {
          // Build row object
          const rowObj: Record<string, unknown> = {};
          headers.forEach((h, i) => { rowObj[h] = row[i] || ""; });

          // Check if all cells are empty
          const hasAnyContent = row.some(cell => cell && cell.trim().length > 0);
          if (!hasAnyContent) {
            tabSkipped++;
            skipReasons["empty_row"] = (skipReasons["empty_row"] || 0) + 1;
            continue;
          }

          // Extract amount FIRST - this is the primary filter
          const { value: amount, type } = extractAmount(rowObj, mapping);
          if (amount === null) {
            tabSkipped++;
            skipReasons["no_value"] = (skipReasons["no_value"] || 0) + 1;
            continue;
          }

          tabWithValue++;

          // Parse date
          const dateRaw = mapping.date ? rowObj[mapping.date] : null;
          const date = parseDate(dateRaw as string | number | null);

          // Get description
          const description = mapping.description ? String(rowObj[mapping.description] || "").trim() : "";

          // RELAXED skip check: pass hasValidDate
          const skipCheck = isSkippableRow(rowObj, description, !!date);
          if (skipCheck.skip) {
            tabSkipped++;
            tabWithValue--; // Don't count as "with value" if skipped
            skipReasons[skipCheck.reason || "unknown"] = (skipReasons[skipCheck.reason || "unknown"] || 0) + 1;
            continue;
          }

          // Use tab's periodKey to infer date if not found
          const finalDate = date || (tab.periodKey ? `${tab.periodKey}-01` : new Date().toISOString().split("T")[0]);
          const category = mapping.category ? String(rowObj[mapping.category] || "").trim() || "Geral" : "Geral";
          const clientVendor = mapping.client_vendor ? String(rowObj[mapping.client_vendor] || "").trim() || null : null;
          const rowHash = generateRowHash({ description, amount, date: finalDate, type, category });
          const externalRowKey = `${tab.title}:${rowNumber}:${rowHash}`;

          const movementType = detectMovementType(category, description, type);

          batch.push({
            user_id: userId,
            description: description || "Sem descrição",
            amount: Math.round(amount * 100) / 100,
            date: finalDate,
            type,
            category,
            client_vendor: clientVendor,
            notes: `Importado de: ${connection.spreadsheet_name} > ${tab.title}`,
            source: "sheets",
            source_sheet_id: connectionId!,
            source_tab: tab.title,
            source_row_number: rowNumber,
            external_row_key: externalRowKey,
            raw_data: rowObj,
            movement_type: movementType,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          allErrors.push({ tab: tab.title, row: rowNumber, error: errMsg });
          skipReasons["parse_error"] = (skipReasons["parse_error"] || 0) + 1;
        }
      }

      // ===== BATCH UPSERT =====
      await updateJobHeartbeat(supabase, jobId, `upsert(${tab.title})`, {
        tabs_total: monthlyTabs.length, tabs_done: tabIdx, rows_read: totalScanned + tabScanned,
        rows_imported: totalImported, current_tab: `${tab.title} - importando ${batch.length} linhas...`,
      });

      const upsertResult = await batchUpsertTransactions(supabase, batch, userId, connectionId!, requestId);
      const tabImported = upsertResult.inserted + upsertResult.updated;
      const tabErrors = upsertResult.errors.length;

      for (const err of upsertResult.errors) {
        allErrors.push({ tab: tab.title, row: err.row, error: err.error });
      }

      // ===== SAVE AUDIT =====
      await supabase.from("sync_tab_audit").insert({
        job_id: jobId, user_id: userId, connection_id: connectionId,
        tab_name: tab.title, period_key: tab.periodKey || null,
        rows_scanned: tabScanned, rows_with_value: tabWithValue,
        rows_imported: tabImported, rows_skipped: tabSkipped,
        skip_reasons: skipReasons, errors: upsertResult.errors.slice(0, 20),
      });

      totalImported += tabImported;
      totalSkipped += tabSkipped;
      totalErrors += tabErrors;
      totalScanned += tabScanned;
      totalWithValue += tabWithValue;

      console.log(`[${requestId}] Tab ${tab.title}: scanned=${tabScanned}, withValue=${tabWithValue}, imported=${tabImported}, skipped=${tabSkipped}, errors=${tabErrors}`);
    }

    // ===== Finalize =====
    const finalStatus = totalErrors > 0 ? (totalImported > 0 ? "partial" : "error") : "success";

    if (syncLog) {
      await supabase.from("google_sheet_sync_logs").update({
        rows_processed: totalScanned, rows_imported: totalImported, rows_upserted: totalImported,
        rows_skipped: totalSkipped, errors: allErrors.slice(0, 50), completed_at: new Date().toISOString(), status: finalStatus,
      }).eq("id", syncLog.id);
    }

    await supabase.from("google_sheet_connections").update({ sync_status: finalStatus, last_sync_at: new Date().toISOString() }).eq("id", connectionId);

    await finalizeJob(supabase, jobId, finalStatus === "error" ? "failed" : "success", undefined, undefined, {
      tabs_total: monthlyTabs.length, tabs_done: monthlyTabs.length,
      rows_read: totalScanned, rows_imported: totalImported, current_tab: "Concluído",
    });
    jobId = null;

    console.log(`[${requestId}] DONE: tabs=${monthlyTabs.length}, scanned=${totalScanned}, withValue=${totalWithValue}, imported=${totalImported}, skipped=${totalSkipped}, errors=${totalErrors}, duration=${Date.now() - startTime}ms`);

    return new Response(JSON.stringify({
      success: true, tabs_imported: monthlyTabs.length,
      total_scanned: totalScanned, total_with_value: totalWithValue,
      total_imported: totalImported, total_skipped: totalSkipped, total_errors: totalErrors,
      errors: allErrors.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = errorMessage === "TIMEOUT_INTERNAL";
    console.error(`[${requestId}] Error: ${errorMessage}`);

    if (jobId && supabase!) {
      try {
        await finalizeJob(supabase!, jobId, isTimeout ? "timeout" : "failed", errorMessage, "catch_block");
      } catch (e) {
        console.error(`[${requestId}] Failed to finalize job:`, e);
      }
    }

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
