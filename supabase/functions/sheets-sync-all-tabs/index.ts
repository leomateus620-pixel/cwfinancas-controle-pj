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

type TabRoute = "DRE_ONLY" | "MONTHLY_TRANSACTIONS" | "PAYABLE" | "RECEIVABLE" | "IGNORE";

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

  // Match any tab containing "DRE" (DRE, DRE 2026, DRE-Caixa, DRE Jan26, etc.)
  if (/\bdre\b/i.test(tabName.trim()) || normalized.includes("demonstracao") || normalized.includes("resultado")) {
    return { title: tabName, route: "DRE_ONLY" };
  }

  // ===== PAYABLE / RECEIVABLE detection (before month matching) =====
  const payablePatterns = ["contas a pagar", "a pagar", "pagar", "payable", "despesas agendadas", "pagamentos"];
  const receivablePatterns = ["contas a receber", "a receber", "receber", "receivable", "clientes a receber", "recebimentos"];
  
  // Exclusion: avoid matching DRE-like or summary tabs
  const excludePatterns = ["demonstracao", "resultado", "tendencia", "plano de contas", "resumo", "notas fiscais", "notas emitidas", "extrato", "movimentacao"];
  const isExcluded = excludePatterns.some(p => normalized.includes(p));
  
  if (!isExcluded) {
    const isPayable = payablePatterns.some(p => normalized.includes(p));
    const isReceivable = receivablePatterns.some(p => normalized.includes(p));
    
    if (isPayable && !isReceivable) {
      return { title: tabName, route: "PAYABLE" };
    }
    if (isReceivable && !isPayable) {
      return { title: tabName, route: "RECEIVABLE" };
    }
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

// ============ Safe string coercion for xlsx values ============
function safeStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
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
  let str = safeStr(value).trim();
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
  } else if (lastDot > lastComma && lastComma >= 0) {
    normalized = str.replace(/,/g, "");
  } else if (lastComma >= 0 && lastDot === -1) {
    if (commaCount === 1) {
      const afterComma = str.split(",")[1];
      normalized = afterComma && afterComma.length <= 2 ? str.replace(",", ".") : str.replace(",", "");
    } else {
      normalized = str.replace(/,/g, "");
    }
  } else if (lastDot >= 0 && lastComma === -1) {
    if (dotCount >= 2) {
      normalized = str.replace(/\./g, "");
    } else {
      const afterDot = str.substring(lastDot + 1);
      if (/^\d{3}$/.test(afterDot)) {
        normalized = str.replace(".", "");
      }
    }
  }
  const num = parseFloat(normalized);
  if (isNaN(num)) return null;
  const isNegative = isNegativeParens || isNegativePrefix || isNegativeSuffix;
  return isNegative ? -num : num;
}

// ============ Bank Balance Extraction ============

function format_period_now(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface BankBalanceExtracted {
  rows: Array<{ bankName: string; opening: number | null; closing: number | null }>;
  warnings: string[];
}

/**
 * Dedicated Google Sheets read for the bank balance block (columns H-J).
 * Tries tight range H3:J5 first, then fallback H1:J20.
 */
/** Validate that bank balance rows contain at least one non-numeric bank name and one numeric value */
function isValidBankBalanceData(rows: string[][]): boolean {
  const knownBanks = [
    "sicredi", "banrisul", "unicred", "cresol", "caixa", "banco do brasil", "bb",
    "itau", "itaú", "bradesco", "santander", "nubank", "inter", "c6", "safra",
    "original", "pan", "bmg", "daycoval", "pine", "abc brasil", "votorantim",
    "pagbank", "pagseguro", "mercado pago", "stone", "cielo", "rede",
    "fatura cc", "cartao", "cartão", "asaas",
  ];
  for (const row of rows) {
    const col0 = String(row[0] ?? "").trim();
    if (!col0) continue;
    const cleaned = col0.replace(/[R$.\s]/g, "").replace(",", ".");
    // col0 must NOT parse as a number (it should be a bank name)
    if (isNaN(Number(cleaned))) {
      // Stronger signal: check if it matches a known bank name
      const norm = col0.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const matchesKnown = knownBanks.some(b => norm.includes(b) || norm === b);
      // And at least one of col1/col2 should be numeric
      const col1 = parseBRL(row[1]);
      const col2 = parseBRL(row[2]);
      if ((col1 !== null || col2 !== null) && (matchesKnown || norm.length >= 3)) return true;
    }
  }
  return false;
}

async function readBankBalanceRange(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
  requestId: string
): Promise<string[][]> {
  // Try G-I first (StarSync layout), then H-J (GR layout)
  const candidateRanges = [
    `'${tabTitle}'!G2:I4`, `'${tabTitle}'!G1:I20`,
    `'${tabTitle}'!H3:J5`, `'${tabTitle}'!H1:J20`,
  ];
  for (const range of candidateRanges) {
    try {
      const resp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!resp.ok) {
        console.log(`[${requestId}] [bank-balance] range=${range} status=${resp.status}, skipping`);
        continue;
      }
      const data = await resp.json();
      const values: string[][] = data.values || [];
      if (values.length > 0) {
        console.log(`[${requestId}] [bank-balance] tab=${tabTitle} range=${range} rows=${values.length} cols=${values[0]?.length}`);
        if (isValidBankBalanceData(values)) {
          return values;
        }
        console.log(`[${requestId}] [bank-balance] range=${range} failed validation (no valid bank names), trying next`);
        continue;
      }
    } catch (e) {
      console.warn(`[${requestId}] [bank-balance] fetch error for range=${range}:`, e);
    }
  }
  console.log(`[${requestId}] [bank-balance] tab=${tabTitle} no valid data in G-I or H-J ranges`);
  return [];
}

/**
 * Extract bank balances from a 3-column array (H-J data).
 * Col 0 = bank name or header, Col 1 = opening, Col 2 = closing.
 */
function extractBankBalances(
  rows: string[][],
  tab: ClassifiedTab,
  parseFn: (v: string | number | null | undefined) => number | null
): BankBalanceExtracted {
  const result: BankBalanceExtracted = { rows: [], warnings: [] };
  if (!rows || rows.length === 0) return result;

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Find header row: contains "saldo bancario" or "saldo inicial"/"saldo final"
  let dataStartRow = 0;
  for (let r = 0; r < rows.length; r++) {
    const cells = (rows[r] || []).map(c => normalize(safeStr(c)));
    const joined = cells.join(" ");
    if (joined.includes("saldo bancario") || joined.includes("saldo inicial") || joined.includes("inicial")) {
      dataStartRow = r + 1;
      break;
    }
  }

  // If no header found and we have rows, assume row 0 is header (tight range H3:J3 scenario)
  if (dataStartRow === 0 && rows.length > 1) {
    // Check if row 0 looks like a header (non-numeric col 0)
    const firstCell = normalize(safeStr(rows[0]?.[0]));
    if (firstCell && parseFn(rows[0]?.[0]) === null) {
      dataStartRow = 1;
    }
    result.warnings.push("Header 'Saldo inicial/final' nao encontrado, usando posicao fixa.");
  }

  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r] || [];
    const bankName = safeStr(row[0]).trim();
    if (!bankName) break;
    const normBank = normalize(bankName);
    if (normBank.includes("total") || normBank.includes("soma")) break;

    const rawOpening = parseFn(row[1]);
    const rawClosing = parseFn(row[2]);
    const opening = rawOpening !== null ? Math.round(rawOpening * 100) / 100 : null;
    const closing = rawClosing !== null ? Math.round(rawClosing * 100) / 100 : null;

    console.log(`[bank-balance] "${bankName}" raw=[${row[1]}, ${row[2]}] parsed=[${rawOpening}, ${rawClosing}] rounded=[${opening}, ${closing}]`);

    if (opening === null && closing === null) {
      result.warnings.push(`Banco "${bankName}": ambos saldos vazios.`);
    }

    result.rows.push({ bankName, opening, closing });
  }

  return result;
}

function looksLikeDate(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = safeStr(value).trim();
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

// ============ Dynamic Header Detection ============

const HEADER_KEYWORDS = [
  "data", "date", "dt", "vencimento", "competencia", "emissao", "lancado",
  "descricao", "historico", "lancamento", "obs", "observacao", "memo", "detalhe", "description",
  "valor", "montante", "quantia", "vlr", "amount", "value",
  "tipo", "natureza", "d/c", "type", "operacao",
  "categoria", "classificacao", "grupo", "centro de custo", "category",
  "cliente", "fornecedor", "razao social", "empresa", "parceiro", "favorecido",
  "credito", "entrada", "receita", "credit", "recebido", "recebimento",
  "debito", "saida", "despesa", "debit", "pago", "pagamento",
  "conta", "banco", "account", "nome", "razao",
];

function detectHeaderRow(rows: unknown[][]): number {
  if (rows.length === 0) return 0;
  const scanLimit = Math.min(rows.length, 20);
  let bestRow = 0;
  let bestScore = 0;

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    const nonEmpty = row.filter(c => c !== null && c !== undefined && safeStr(c).trim().length > 0).length;
    if (nonEmpty < 2) continue;

    let keywordMatches = 0;
    for (const cell of row) {
      const cellNorm = safeStr(cell).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (!cellNorm) continue;
      for (const kw of HEADER_KEYWORDS) {
        if (cellNorm === kw || cellNorm.includes(kw)) {
          keywordMatches++;
          break;
        }
      }
    }

    const score = keywordMatches * 10 + nonEmpty;
    if (keywordMatches >= 2 && score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }

  return bestRow;
}

// ============ BANK/ACCOUNT NAME DETECTION ============

const BANK_NAMES = [
  "sicredi", "banrisul", "unicred", "cresol", "caixa", "banco do brasil", "bb",
  "itau", "itaú", "bradesco", "santander", "nubank", "inter", "c6", "safra",
  "original", "pan", "bmg", "daycoval", "pine", "abc brasil", "votorantim",
  "pagbank", "pagseguro", "mercado pago", "stone", "cielo", "rede",
  "fatura cc", "cartao", "cartão", "asaas",
];

function looksLikeBankName(value: string): boolean {
  const v = safeStr(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!v) return false;
  return BANK_NAMES.some(b => v.includes(b) || v === b);
}

function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedColumnIndices = new Set<number>();
  const normalizedHeaders = headers.map(h =>
    safeStr(h).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  );

  // Category uses STRICT header matching only — no fuzzy prefix
  const orderedPatterns: Array<[string, string[], boolean]> = [
    ["date", ["data", "dt", "date", "vencimento", "competencia", "emissao", "lancado", "dt pagamento", "data pagamento", "data lancamento"], false],
    ["category", ["categoria", "classificacao", "classificação", "category", "centro de custo", "plano de contas"], true],
    ["account", ["conta", "banco", "account", "conta bancaria", "instituicao", "conta banco"], true],
    ["description", ["descricao", "historico", "lancamento", "obs", "observacao", "memo", "detalhe", "detail", "description", "desc.", "hist.", "descr"], false],
    ["amount", ["valor", "montante", "quantia", "vlr", "amount", "value", "vlr total", "valor total", "total"], false],
    ["type", ["tipo", "natureza", "d/c", "entrada/saida", "type", "operacao", "tipo de lancamento", "tipo lancamento"], false],
    ["client_vendor", ["cliente", "fornecedor", "razao social", "empresa", "parceiro", "favorecido", "nome", "razao", "sacado", "pagador", "beneficiario"], false],
    ["credit", ["credito", "entrada", "receita", "credit", "recebido", "recebimento", "vlr credito", "valor credito"], false],
    ["debit", ["debito", "saida", "despesa", "debit", "pago", "pagamento", "vlr debito", "valor debito"], false],
  ];

  for (const [field, keywords, strictOnly] of orderedPatterns) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (usedColumnIndices.has(i)) continue;
      const header = normalizedHeaders[i];
      if (!header) continue;

      const matched = keywords.some(k => {
        if (header === k) return true;
        const regex = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (regex.test(header)) return true;
        // Only allow prefix matching for non-strict fields, and ONLY header.startsWith(keyword)
        if (!strictOnly && k.length >= 4 && header.startsWith(k)) return true;
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

// ============ Density-Based Amount Column Detection ============
// Fallback when header-based mapping fails to find amount/credit/debit columns.
// Scans first N data rows to find the column with highest parseable monetary value density.

function detectAmountByDensity(
  headers: string[],
  dataRows: unknown[][],
  mapping: Record<string, string>,
  requestId: string
): void {
  // Only activate if no amount/credit/debit mapped
  if (mapping.amount || mapping.credit || mapping.debit) return;

  // Build set of already-mapped column indices
  const mappedIndices = new Set<number>();
  for (const field of Object.values(mapping)) {
    const idx = headers.indexOf(field);
    if (idx >= 0) mappedIndices.add(idx);
  }

  const sampleSize = Math.min(dataRows.length, 50);
  if (sampleSize === 0) return;

  let bestColIdx = -1;
  let bestDensity = 0;

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    if (mappedIndices.has(colIdx)) continue;

    let parseable = 0;
    for (let rowIdx = 0; rowIdx < sampleSize; rowIdx++) {
      const row = dataRows[rowIdx];
      if (!Array.isArray(row)) continue;
      const cellVal = row[colIdx];
      if (cellVal === null || cellVal === undefined) continue;
      if (looksLikeDate(cellVal)) continue;
      const parsed = parseBRL(cellVal as string | number);
      if (parsed !== null) parseable++;
    }

    const density = parseable / sampleSize;
    if (density > bestDensity) {
      bestDensity = density;
      bestColIdx = colIdx;
    }
  }

  if (bestColIdx >= 0 && bestDensity > 0.3) {
    // Use synthetic key if header is empty
    const headerKey = headers[bestColIdx] && safeStr(headers[bestColIdx]).trim()
      ? headers[bestColIdx]
      : `__col_${bestColIdx}`;
    mapping.amount = headerKey;
    // Also update the headers array to use synthetic key for empty headers
    if (!headers[bestColIdx] || !safeStr(headers[bestColIdx]).trim()) {
      headers[bestColIdx] = headerKey;
    }
    console.log(`[${requestId}] DENSITY FALLBACK: col ${bestColIdx} ("${headerKey}") detected as amount (density=${(bestDensity * 100).toFixed(0)}%)`);
  }
}

// ============ Post-Mapping Validation with Data Analysis ============

function validateAndFixMapping(
  mapping: Record<string, string>,
  headers: string[],
  dataRows: unknown[][],
  requestId: string
): Record<string, string> {
  const fixed = { ...mapping };

  // If no category mapped, try to find one by data analysis
  if (!fixed.category && !fixed.account) return fixed;

  // Get column indices
  const catColIdx = fixed.category ? headers.indexOf(fixed.category) : -1;
  const accColIdx = fixed.account ? headers.indexOf(fixed.account) : -1;

  // Analyze category column values if mapped
  if (catColIdx >= 0) {
    const sampleSize = Math.min(dataRows.length, 100);
    let bankCount = 0;
    let totalNonEmpty = 0;
    let totalCharLen = 0;

    for (let i = 0; i < sampleSize; i++) {
      const row = dataRows[i];
      if (!Array.isArray(row)) continue;
      const val = safeStr(row[catColIdx]).trim();
      if (!val) continue;
      totalNonEmpty++;
      totalCharLen += val.length;
      if (looksLikeBankName(val)) bankCount++;
    }

    const bankRatio = totalNonEmpty > 0 ? bankCount / totalNonEmpty : 0;
    const avgLen = totalNonEmpty > 0 ? totalCharLen / totalNonEmpty : 0;

    // If >60% of values are bank names → this is actually the account column, not category
    if (bankRatio > 0.6) {
      console.warn(`[${requestId}] CATEGORY SWAP DETECTED: ${bankRatio * 100}% bank names in category col "${fixed.category}"`);
      // Swap category and account
      if (fixed.account) {
        // Check if account col has actual categories
        const accSample = dataRows.slice(0, sampleSize);
        let accBankCount = 0;
        let accTotal = 0;
        for (const row of accSample) {
          if (!Array.isArray(row)) continue;
          const val = safeStr(row[accColIdx]).trim();
          if (!val) continue;
          accTotal++;
          if (looksLikeBankName(val)) accBankCount++;
        }
        const accBankRatio = accTotal > 0 ? accBankCount / accTotal : 0;

        if (accBankRatio < 0.3) {
          // Account col has real categories → swap them
          console.warn(`[${requestId}] SWAPPING: category="${fixed.category}" <-> account="${fixed.account}"`);
          const temp = fixed.category;
          fixed.category = fixed.account;
          fixed.account = temp;
        } else {
          // Both look like banks → remove category mapping
          console.warn(`[${requestId}] REMOVING bad category mapping "${fixed.category}"`);
          delete fixed.category;
        }
      } else {
        // No account column → move category to account, remove category
        console.warn(`[${requestId}] MOVING "${fixed.category}" from category to account`);
        fixed.account = fixed.category;
        delete fixed.category;
      }
    }

    // Check if category looks like description (avg length > 25)
    if (fixed.category && avgLen > 25) {
      console.warn(`[${requestId}] Category col "${fixed.category}" has avg length ${avgLen.toFixed(0)}, likely a description col`);
      // Don't swap with description, just remove the bad category mapping
      delete fixed.category;
    }
  }

  return fixed;
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
            const typeValue = safeStr(typeRaw).toLowerCase().trim();
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

function isSkippableRow(rowObj: Record<string, unknown>, description: string, hasValidDate: boolean): { skip: boolean; reason?: string } {
  const descLower = safeStr(description).toLowerCase().trim();
  
  const allValues = Object.values(rowObj).map(v => safeStr(v).toLowerCase().trim());
  const headerKeywords = ["data", "date", "valor", "value", "descrição", "descricao", "description", "categoria", "category"];
  const headerMatchCount = headerKeywords.filter(k => allValues.some(v => v === k || v.includes(k))).length;
  if (headerMatchCount >= 2) return { skip: true, reason: "HEADER_ROW_DETECTED" };

  if (!hasValidDate) {
    const totalKeywords = ["total", "subtotal", "saldo", "soma", "acumulado", "resumo", "balanço", "balanco", "sum", "balance"];
    if (totalKeywords.some(k => descLower.includes(k))) return { skip: true, reason: "TOTAL_ROW_DETECTED" };
  }

  return { skip: false };
}

function parseDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || /^\d+$/.test(safeStr(value))) {
    const serial = typeof value === "number" ? value : parseInt(safeStr(value));
    if (serial > 25000 && serial < 60000) {
      const date = new Date((serial - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
    }
  }
  const str = safeStr(value).trim();
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
  const maxRow = Math.min(tabRowCount, 10000);

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
    
    if (values.length === 0) break;
    
    allRows.push(...values);
    
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

// ============ Transaction Row Interface ============

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
  stable_key: string;
  content_hash: string;
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
  const catLower = safeStr(category).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const descLower = safeStr(description).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const kw of TRANSFER_CATEGORY_KEYWORDS) {
    const kwNorm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (catLower.includes(kwNorm)) return "TRANSFER";
  }

  const transferDescKeywords = ["transferencia entre", "transf entre contas", "movimentacao entre"];
  for (const kw of transferDescKeywords) {
    const kwNorm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (descLower.includes(kwNorm)) return "TRANSFER";
  }

  return type === "income" ? "INCOME" : "EXPENSE";
}

// ============ Reconcile & Upsert (2-Layer Idempotency with Realignment) ============

async function reconcileAndUpsert(
  supabase: SupabaseClient,
  batch: TransactionRow[],
  userId: string,
  connectionId: string,
  requestId: string
): Promise<{ inserted: number; updated: number; noOps: number; errors: Array<{ row: number; error: string }> }> {
  if (batch.length === 0) return { inserted: 0, updated: 0, noOps: 0, errors: [] };

  // 1. Fetch ALL existing records for this connection + tabs
  const tabNames = [...new Set(batch.map(b => b.source_tab))];
  const existingMap = new Map<string, { id: string; content_hash: string | null; source_row_number: number | null }>();
  const contentIndex = new Map<string, Array<{ id: string; stable_key: string | null; source_row_number: number | null }>>();

  for (const tabName of tabNames) {
    // Fetch in pages of 1000 to handle large tabs
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data } = await supabase.from("transactions")
        .select("id, stable_key, content_hash, source_row_number")
        .eq("user_id", userId)
        .eq("source_sheet_id", connectionId)
        .eq("source_tab", tabName)
        .range(from, from + pageSize - 1);

      if (data) {
        for (const row of data) {
          if (row.stable_key) existingMap.set(row.stable_key, row);
          const key = row.content_hash || "";
          if (!contentIndex.has(key)) contentIndex.set(key, []);
          contentIndex.get(key)!.push(row);
        }
        hasMore = data.length === pageSize;
        from += pageSize;
      } else {
        hasMore = false;
      }
    }
  }

  console.log(`[${requestId}] Reconcile: batch=${batch.length}, existing=${existingMap.size}`);

  // Track matched IDs to avoid double-matching
  const matchedIds = new Set<string>();

  let noOps = 0;
  const toInsert: TransactionRow[] = [];
  const toUpdate: Array<{ id: string } & TransactionRow> = [];

  for (const row of batch) {
    // STEP A: Try match by stable_key
    const existing = existingMap.get(row.stable_key);
    if (existing && !matchedIds.has(existing.id)) {
      matchedIds.add(existing.id);
      if (existing.content_hash === row.content_hash) {
        noOps++;
      } else {
        toUpdate.push({ id: existing.id, ...row });
      }
      continue;
    }

    // STEP B: Fallback — match by content_hash (realignment for row shifts)
    const candidates = contentIndex.get(row.content_hash) || [];
    const unmatched = candidates.filter(c => !matchedIds.has(c.id));

    if (unmatched.length > 0) {
      // Tie-break: closest rowIndex
      unmatched.sort((a, b) =>
        Math.abs((a.source_row_number || 0) - row.source_row_number) -
        Math.abs((b.source_row_number || 0) - row.source_row_number)
      );
      const best = unmatched[0];
      matchedIds.add(best.id);

      // UPDATE stable_key to new value (realignment) + update fields if content changed
      toUpdate.push({ id: best.id, ...row });
      continue;
    }

    // STEP C: No match → INSERT
    toInsert.push(row);
  }

  console.log(`[${requestId}] Reconcile result: insert=${toInsert.length}, update=${toUpdate.length}, noOp=${noOps}`);

  let inserted = 0;
  let updated = 0;
  const errors: Array<{ row: number; error: string }> = [];

  // Execute INSERTs in batches
  for (const chunk of chunks(toInsert, BATCH_UPSERT_SIZE)) {
    const { error } = await supabase.from("transactions").insert(chunk);
    if (error) {
      console.warn(`[${requestId}] Batch insert failed (${chunk.length} rows), falling back: ${error.message}`);
      for (const r of chunk) {
        const { error: e } = await supabase.from("transactions").insert(r);
        if (e) errors.push({ row: r.source_row_number, error: e.message });
        else inserted++;
      }
    } else {
      inserted += chunk.length;
    }
  }

  // Execute UPDATEs individually (by id)
  for (const row of toUpdate) {
    const { id, ...data } = row;
    const { error } = await supabase.from("transactions")
      .update(data).eq("id", id);
    if (error) errors.push({ row: data.source_row_number, error: error.message });
    else updated++;
  }

  return { inserted, updated, noOps, errors };
}

// ============ Tab Fingerprint ============

function computeTabFingerprint(rows: unknown[][], headerRow: number): string {
  const header = (rows[headerRow] || []).map(c => safeStr(c)).join("|");
  const sampleRows = rows.slice(headerRow + 1, headerRow + 51);
  const sample = sampleRows.map(r =>
    (Array.isArray(r) ? r : []).slice(0, 5).map(c => safeStr(c).trim().substring(0, 20)).join("|")
  ).join("\n");
  return generateRowHash({ header, sample });
}

// ============ Content Hash Generation ============

function computeContentHash(
  finalDate: string,
  amount: number,
  description: string,
  category: string,
  clientVendor: string | null,
): string {
  return generateRowHash({
    d: finalDate,
    a: Math.round(amount * 100),
    desc: (description || "").toLowerCase().trim().replace(/\s+/g, " "),
    cat: (category || "").toLowerCase().trim(),
    cv: (clientVendor || "").toLowerCase().trim(),
  });
}

// ============ Lock helpers ============

async function acquireLock(supabase: SupabaseClient, connectionId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("google_sheet_connections")
    .update({ lock_until: lockUntil, sync_status: "syncing" })
    .eq("id", connectionId)
    .or(`lock_until.is.null,lock_until.lt.${now}`)
    .select("id");
  return !!(data && data.length > 0);
}

async function releaseLock(supabase: SupabaseClient, connectionId: string): Promise<void> {
  await supabase.from("google_sheet_connections")
    .update({ lock_until: null })
    .eq("id", connectionId);
}

// ============ Drive fingerprint ============

async function getDriveFingerprint(accessToken: string, spreadsheetId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=modifiedTime&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.modifiedTime || null;
  } catch {
    return null;
  }
}

// ============ Main handler ============

interface SyncAllTabsRequest {
  connection_id: string;
  month_range?: { from: string; to: string };
  selected_tabs?: string[];
  // Internal: called by scheduled-sync with service role, skip user auth
  _internal_user_id?: string;
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
    
    const body: SyncAllTabsRequest = await req.json();
    connectionId = body.connection_id;
    const { month_range, selected_tabs } = body;

    // Determine userId: internal call (from scheduled-sync) or user auth
    let userId: string;
    if (body._internal_user_id) {
      userId = body._internal_user_id;
    } else {
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.user.id;
    }

    if (!connectionId) throw new Error("connection_id is required");

    console.log(`[${requestId}] User: ${userId}, Connection: ${connectionId}, SelectedTabs: ${JSON.stringify(selected_tabs)}, Range: ${JSON.stringify(month_range)}`);

    // ===== LOCK =====
    const lockAcquired = await acquireLock(supabase, connectionId);
    if (!lockAcquired) {
      return new Response(JSON.stringify({ error: "sync_locked", message: "Another sync is already running" }), {
        status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== JOB CONTROL =====
    const jobResult = await checkAndClaimJob(supabase, userId, connectionId, "ALL_TABS", requestId);
    if ("error" in jobResult) {
      await releaseLock(supabase, connectionId);
      return new Response(JSON.stringify({ error: jobResult.error }), {
        status: jobResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    jobId = jobResult.jobId;

    // ===== STEP: auth =====
    await updateJobHeartbeat(supabase, jobId, "auth", { tabs_total: 0, tabs_done: 0, rows_read: 0, rows_imported: 0, current_tab: "Autenticando..." });

    const { data: connection, error: connError } = await supabase
      .from("google_sheet_connections").select("*").eq("id", connectionId).eq("user_id", userId).single();
    if (connError || !connection) {
      await releaseLock(supabase, connectionId);
      throw new Error("Connection not found");
    }

    let accessToken = connection.access_token;
    const tokenExpired = !connection.token_expires_at || new Date(connection.token_expires_at) < new Date();
    if (tokenExpired || !accessToken) {
      const refreshed = await refreshAccessToken(connection.refresh_token);
      accessToken = refreshed.access_token;
      await supabase.from("google_sheet_connections").update({
        access_token: refreshed.access_token, token_expires_at: refreshed.expires_at,
      }).eq("id", connectionId);
    }

    // ===== FINGERPRINT CHECK (Drive modifiedTime) =====
    const driveFingerprint = await getDriveFingerprint(accessToken!, connection.spreadsheet_id);
    if (driveFingerprint && connection.last_source_fingerprint === driveFingerprint) {
      console.log(`[${requestId}] Drive fingerprint unchanged, skipping sync`);
      await finalizeJob(supabase, jobId, "success", undefined, undefined, {
        tabs_total: 0, tabs_done: 0, rows_read: 0, rows_imported: 0, current_tab: "Sem alterações",
      });
      await supabase.from("google_sheet_connections").update({ 
        sync_status: "success", last_sync_at: new Date().toISOString() 
      }).eq("id", connectionId);
      await releaseLock(supabase, connectionId);
      jobId = null;
      return new Response(JSON.stringify({
        success: true, skipped: true, reason: "no_changes",
        total_imported: 0, total_skipped: 0, total_errors: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    // Filter by selected_tabs (new) or month_range (legacy fallback)
    if (selected_tabs && selected_tabs.length > 0) {
      const selectedMonths = new Set(selected_tabs.map(pk => pk.slice(-2)));
      monthlyTabs = monthlyTabs.filter(t => {
        if (!t.monthIndex) return false;
        return selectedMonths.has(String(t.monthIndex).padStart(2, "0"));
      });
    } else if (month_range) {
      const rangeFromMonth = month_range.from.slice(-2);
      const rangeToMonth = month_range.to.slice(-2);
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
    let totalNoOps = 0;
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
        await releaseLock(supabase, connectionId);

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
        await supabase.from("sync_tab_audit").insert({
          job_id: jobId, user_id: userId, connection_id: connectionId,
          tab_name: tab.title, period_key: tab.periodKey || null,
          rows_scanned: 0, rows_with_value: 0, rows_imported: 0, rows_skipped: 0,
          skip_reasons: { empty_tab: 1 }, errors: [],
        });
        continue;
      }

      // ===== Dynamic header detection =====
      const headerRowIndex = detectHeaderRow(allRows);
      const headers = allRows[headerRowIndex].map(h => safeStr(h));
      const dataRows = allRows.slice(headerRowIndex + 1);
      const rawMapping = autoDetectMapping(headers);
      // Density-based fallback for amount column (handles empty headers)
      detectAmountByDensity(headers, dataRows, rawMapping, requestId);
      const mapping = validateAndFixMapping(rawMapping, headers, dataRows, requestId);

      // Fix description mapping: if mapped column is mostly empty but another "descricao" column has data, switch
      if (mapping.description) {
        const descColIdx = headers.indexOf(mapping.description);
        const normalizedHeaders = headers.map(h => safeStr(h).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
        const altDescCols: Array<{ idx: number; header: string }> = [];
        for (let i = 0; i < normalizedHeaders.length; i++) {
          if (i === descColIdx) continue;
          if (normalizedHeaders[i].includes("descricao") || normalizedHeaders[i].includes("description") || normalizedHeaders[i].includes("historico")) {
            altDescCols.push({ idx: i, header: headers[i] });
          }
        }
        if (altDescCols.length > 0) {
          const sampleSize = Math.min(dataRows.length, 50);
          let mainFilled = 0;
          const altFilled = altDescCols.map(() => 0);
          for (let i = 0; i < sampleSize; i++) {
            const row = dataRows[i];
            if (!Array.isArray(row)) continue;
            if (safeStr(row[descColIdx]).trim()) mainFilled++;
            altDescCols.forEach((alt, j) => { if (safeStr(row[alt.idx]).trim()) altFilled[j]++; });
          }
          const mainRate = sampleSize > 0 ? mainFilled / sampleSize : 0;
          // Find best alternative
          let bestAltIdx = -1;
          let bestAltRate = 0;
          altFilled.forEach((count, j) => {
            const rate = sampleSize > 0 ? count / sampleSize : 0;
            if (rate > bestAltRate) { bestAltRate = rate; bestAltIdx = j; }
          });
          if (mainRate < 0.3 && bestAltRate > 0.3 && bestAltIdx >= 0) {
            console.log(`[${requestId}] DESCRIPTION SWAP: "${mapping.description}" (${(mainRate*100).toFixed(0)}% filled) -> "${altDescCols[bestAltIdx].header}" (${(bestAltRate*100).toFixed(0)}% filled)`);
            mapping.description = altDescCols[bestAltIdx].header;
          }
        }
      }

      console.log(`[${requestId}] Tab ${tab.title}: headerRow=${headerRowIndex}, ${dataRows.length} data rows, rawMapping: ${JSON.stringify(rawMapping)}, finalMapping: ${JSON.stringify(mapping)}`);

      // ===== TAB FINGERPRINT CHECK =====
      const tabFingerprint = computeTabFingerprint(allRows, headerRowIndex);
      
      // Check if tab fingerprint matches last audit
      const { data: lastAudit } = await supabase.from("sync_tab_audit")
        .select("skip_reasons")
        .eq("user_id", userId)
        .eq("connection_id", connectionId)
        .eq("tab_name", tab.title)
        .order("created_at", { ascending: false })
        .limit(1);
      
      const lastFingerprint = lastAudit?.[0]?.skip_reasons?.tab_fingerprint;
      if (lastFingerprint && lastFingerprint === tabFingerprint) {
        console.log(`[${requestId}] Tab ${tab.title}: fingerprint unchanged, skipping`);
        await supabase.from("sync_tab_audit").insert({
          job_id: jobId, user_id: userId, connection_id: connectionId,
          tab_name: tab.title, period_key: tab.periodKey || null,
          rows_scanned: 0, rows_with_value: 0, rows_imported: 0, rows_skipped: 0,
          skip_reasons: { tab_fingerprint: tabFingerprint, skipped_no_changes: 1 }, errors: [],
        });
        continue;
      }

      // Check if mapping has at least a value column
      if (!mapping.amount && !mapping.credit && !mapping.debit) {
        console.warn(`[${requestId}] Tab ${tab.title}: NO value column detected, skipping tab`);
        await supabase.from("sync_tab_audit").insert({
          job_id: jobId, user_id: userId, connection_id: connectionId,
          tab_name: tab.title, period_key: tab.periodKey || null,
          rows_scanned: dataRows.length, rows_with_value: 0, rows_imported: 0, rows_skipped: dataRows.length,
          skip_reasons: { COLUMN_MAP_EMPTY: dataRows.length }, errors: [{ row: headerRowIndex + 1, error: `Headers detected: [${headers.join(", ")}]. No value/credit/debit column mapped.` }],
        });
        totalSkipped += dataRows.length;
        totalScanned += dataRows.length;
        continue;
      }

      // ===== Generate headerSig once per tab =====
      const mappedCols = Object.keys(mapping).sort().join(",");
      const headerSig = generateRowHash({ cols: mappedCols }).slice(0, 6);

      // ===== Parse all rows into batch =====
      const batch: TransactionRow[] = [];
      const skipReasons: Record<string, number> = {};
      let tabScanned = 0;
      let tabWithValue = 0;
      let tabSkipped = 0;
      const tabErrors: Array<{ row: number; error: string; raw?: string }> = [];

      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
        const row = dataRows[rowIndex];
        const rowNumber = headerRowIndex + rowIndex + 2; // 1-indexed, +1 for header offset
        tabScanned++;

        try {
          // Build row object
          const rowObj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            const key = safeStr(h).trim() || `__col_${i}`;
            rowObj[key] = row[i] ?? "";
          });

          // Check if all cells are empty
          const hasAnyContent = row.some(cell => cell !== null && cell !== undefined && safeStr(cell).trim().length > 0);
          if (!hasAnyContent) {
            tabSkipped++;
            skipReasons["empty_row"] = (skipReasons["empty_row"] || 0) + 1;
            continue;
          }

          // Extract amount FIRST
          const { value: amount, type } = extractAmount(rowObj, mapping);
          if (amount === null) {
            tabSkipped++;
            skipReasons["VALUE_PARSE_FAIL"] = (skipReasons["VALUE_PARSE_FAIL"] || 0) + 1;
            if (tabErrors.length < 5) {
              const rawFields = Object.entries(rowObj).slice(0, 5).map(([k, v]) => `${k}=${safeStr(v).substring(0, 30)}`).join("; ");
              tabErrors.push({ row: rowNumber, error: "VALUE_PARSE_FAIL", raw: rawFields });
            }
            continue;
          }

          tabWithValue++;

          // Parse date
          const dateRaw = mapping.date ? rowObj[mapping.date] : null;
          const date = parseDate(dateRaw as string | number | null);

          // Get description
          let description = mapping.description ? safeStr(rowObj[mapping.description]).trim() : "";

          // Skip check
          const skipCheck = isSkippableRow(rowObj, description, !!date);
          if (skipCheck.skip) {
            tabSkipped++;
            tabWithValue--;
            skipReasons[skipCheck.reason || "unknown"] = (skipReasons[skipCheck.reason || "unknown"] || 0) + 1;
            continue;
          }

          // Use tab's periodKey to infer date if not found
          const finalDate = date || (tab.periodKey ? `${tab.periodKey}-01` : new Date().toISOString().split("T")[0]);
          let category = mapping.category ? safeStr(rowObj[mapping.category]).trim() || "Geral" : "Geral";
          // Safety: if category looks like a bank name, replace with "Sem categoria"
          if (category !== "Geral" && looksLikeBankName(category)) {
            category = "Sem categoria";
          }
          let clientVendor: string | null = mapping.client_vendor ? safeStr(rowObj[mapping.client_vendor]).trim() || null : null;
          const accountName: string | null = mapping.account ? safeStr(rowObj[mapping.account]).trim() || null : null;

          // Heuristic: if description is empty/generic but client_vendor has real data, swap them
          // Then populate client_vendor with account/bank info
          if ((!description || description === "Sem descrição") && clientVendor) {
            description = clientVendor;
            clientVendor = accountName;
          }

          // ===== STABLE KEY (position-based, relative to header) =====
          const dataRowIndex = rowIndex; // 0-based relative to header
          const stableKey = `${tab.title}:${headerSig}:${dataRowIndex}`;

          // ===== CONTENT HASH (content-based, for change detection) =====
          const contentHash = computeContentHash(finalDate, amount, description, category, clientVendor);

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
            external_row_key: stableKey, // Keep for backward compat
            stable_key: stableKey,
            content_hash: contentHash,
            raw_data: rowObj,
            movement_type: movementType,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          const rawFields = Object.entries(dataRows[rowIndex] || {}).slice(0, 5).map(([k, v]) => `${k}=${safeStr(v).substring(0, 30)}`).join("; ");
          allErrors.push({ tab: tab.title, row: rowNumber, error: errMsg });
          tabErrors.push({ row: rowNumber, error: errMsg, raw: rawFields });
          skipReasons["parse_error"] = (skipReasons["parse_error"] || 0) + 1;
        }
      }

      // ===== RECONCILE & UPSERT =====
      await updateJobHeartbeat(supabase, jobId, `upsert(${tab.title})`, {
        tabs_total: monthlyTabs.length, tabs_done: tabIdx, rows_read: totalScanned + tabScanned,
        rows_imported: totalImported, current_tab: `${tab.title} - importando ${batch.length} linhas...`,
      });

      const upsertResult = await reconcileAndUpsert(supabase, batch, userId, connectionId!, requestId);
      const tabImported = upsertResult.inserted + upsertResult.updated;

      for (const err of upsertResult.errors) {
        allErrors.push({ tab: tab.title, row: err.row, error: err.error });
        tabErrors.push({ row: err.row, error: err.error });
      }

      // ===== SAVE AUDIT with fingerprint =====
      await supabase.from("sync_tab_audit").insert({
        job_id: jobId, user_id: userId, connection_id: connectionId,
        tab_name: tab.title, period_key: tab.periodKey || null,
        rows_scanned: tabScanned, rows_with_value: tabWithValue,
        rows_imported: tabImported, rows_skipped: tabSkipped,
        skip_reasons: { ...skipReasons, tab_fingerprint: tabFingerprint, noOps: upsertResult.noOps },
        errors: tabErrors.slice(0, 20),
      });

      // ===== BANK BALANCES EXTRACTION (soft fail) =====
      try {
        const txCols = allRows[0]?.length || 0;
        console.log(`[${requestId}] [bank-balance] tab=${tab.title} txCols=${txCols}`);

        let bankBalanceRows: string[][] = [];
        if (!xlsxWorkbook && accessToken) {
          bankBalanceRows = await readBankBalanceRange(accessToken!, connection.spreadsheet_id, tab.title, requestId);
        } else if (xlsxWorkbook) {
          // For xlsx: try G-I columns (indices 6-8) first, then H-J (indices 7-9)
          const giRows = allRows.map(r => [safeStr(r[6]), safeStr(r[7]), safeStr(r[8])]).filter(r => r[0] || r[1] || r[2]);
          const hjRows = allRows.map(r => [safeStr(r[7]), safeStr(r[8]), safeStr(r[9])]).filter(r => r[0] || r[1] || r[2]);
          if (giRows.length > 0 && isValidBankBalanceData(giRows)) {
            bankBalanceRows = giRows;
            console.log(`[${requestId}] [bank-balance] xlsx using G-I columns (StarSync layout)`);
          } else if (hjRows.length > 0) {
            bankBalanceRows = hjRows;
            console.log(`[${requestId}] [bank-balance] xlsx using H-J columns (GR layout)`);
          }
        }

        if (bankBalanceRows.length > 0) {
          const bankBalances = extractBankBalances(bankBalanceRows, tab, parseBRL);
          console.log(`[${requestId}] [bank-balance] tab=${tab.title} extracted=${bankBalances.rows.length} warnings=${bankBalances.warnings.length}`);

          if (bankBalances.rows.length > 0) {
            const periodKey = tab.periodKey || format_period_now();
            const balanceRows = bankBalances.rows.map(b => ({
              user_id: userId,
              connection_id: connectionId,
              period_key: periodKey,
              bank_name: b.bankName,
              opening_balance: b.opening !== null ? Math.round(b.opening * 100) / 100 : null,
              closing_balance: b.closing !== null ? Math.round(b.closing * 100) / 100 : null,
              tab_name: tab.title,
              updated_at: new Date().toISOString(),
            }));
            const { error: bbErr } = await supabase.from("bank_balances").upsert(balanceRows, {
              onConflict: "user_id,connection_id,period_key,bank_name",
            });
            if (bbErr) {
              console.warn(`[${requestId}] [bank-balance] upsert error for ${tab.title}:`, bbErr.message);
            } else {
              // Confirmation query
              const { count } = await supabase.from("bank_balances")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("period_key", periodKey);
              console.log(`[${requestId}] [bank-balance] confirm persisted count=${count} tab=${tab.title} period=${periodKey}`);
            }
          }
          if (bankBalances.warnings.length > 0) {
            console.warn(`[${requestId}] [bank-balance] warnings for ${tab.title}:`, bankBalances.warnings);
          }
        } else {
          console.log(`[${requestId}] [bank-balance] tab=${tab.title} no H-J data found, skipping`);
        }
      } catch (bbError: unknown) {
        const msg = bbError instanceof Error ? bbError.message : "unknown";
        console.warn(`[${requestId}] [bank-balance] extraction failed for ${tab.title}: ${msg}`);
      }

      totalImported += tabImported;
      totalSkipped += tabSkipped;
      totalErrors += upsertResult.errors.length;
      totalScanned += tabScanned;
      totalWithValue += tabWithValue;
      totalNoOps += upsertResult.noOps;

      console.log(`[${requestId}] Tab ${tab.title}: scanned=${tabScanned}, withValue=${tabWithValue}, inserted=${upsertResult.inserted}, updated=${upsertResult.updated}, noOps=${upsertResult.noOps}, skipped=${tabSkipped}, errors=${upsertResult.errors.length}`);
    }

    // ===== Finalize =====
    const finalStatus = totalErrors > 0 ? (totalImported > 0 ? "partial" : "error") : "success";

    if (syncLog) {
      await supabase.from("google_sheet_sync_logs").update({
        rows_processed: totalScanned, rows_imported: totalImported, rows_upserted: totalImported,
        rows_skipped: totalSkipped, errors: allErrors.slice(0, 50), completed_at: new Date().toISOString(), status: finalStatus,
      }).eq("id", syncLog.id);
    }

    // Save Drive fingerprint on success
    const updateFields: Record<string, unknown> = { 
      sync_status: finalStatus, last_sync_at: new Date().toISOString() 
    };
    if (driveFingerprint) {
      updateFields.last_source_fingerprint = driveFingerprint;
    }
    await supabase.from("google_sheet_connections").update(updateFields).eq("id", connectionId);

    await finalizeJob(supabase, jobId, finalStatus === "error" ? "failed" : "success", undefined, undefined, {
      tabs_total: monthlyTabs.length, tabs_done: monthlyTabs.length,
      rows_read: totalScanned, rows_imported: totalImported, current_tab: "Concluído",
    });
    await releaseLock(supabase, connectionId);
    jobId = null;

    console.log(`[${requestId}] DONE: tabs=${monthlyTabs.length}, scanned=${totalScanned}, withValue=${totalWithValue}, imported=${totalImported}, noOps=${totalNoOps}, skipped=${totalSkipped}, errors=${totalErrors}, duration=${Date.now() - startTime}ms`);

    return new Response(JSON.stringify({
      success: true, tabs_imported: monthlyTabs.length,
      total_scanned: totalScanned, total_with_value: totalWithValue,
      total_imported: totalImported, total_skipped: totalSkipped, total_errors: totalErrors,
      total_no_ops: totalNoOps,
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
        await releaseLock(supabase!, connectionId);
      } catch (_e) { /* best effort */ }
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: isTimeout ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
