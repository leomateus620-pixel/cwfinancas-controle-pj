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

interface SyncRequest {
  connection_id: string;
  mode?: "MANUAL" | "SCHEDULED" | "PUSH";
  preview_only?: boolean;
  auto_detect?: boolean;
}

interface SkipBreakdown {
  empty: number;
  total_row: number;
  header_row: number;
  zero_value: number;
  no_date: number;
}

interface SyncResult {
  success: boolean;
  rows_read: number;
  rows_upserted: number;
  rows_updated: number;
  rows_skipped: number;
  rows_failed: number;
  errors: Array<{ row: number; error: string; raw?: Record<string, unknown> }>;
  skip_breakdown: SkipBreakdown;
  sync_run_id?: string;
}

// Generate a stable hash for row content
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

/**
 * ROBUST Brazilian currency parser - handles ALL common formats
 * Returns null for empty/invalid values (NOT 0!)
 */
function parseBRL(value: string | number | null | undefined): number | null {
  // Return null for truly empty values
  if (value === null || value === undefined) return null;
  
  // If already a number, return it
  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }
  
  let str = String(value).trim();
  
  // Return null for empty strings
  if (!str) return null;
  
  // CRITICAL: Reject date patterns BEFORE any parsing
  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  // Also reject partial dates like "1-dez-2026", "Jan/2026"
  if (/^\d{1,2}[\/\-][a-zA-Záéíóúâêîôûãõ]+[\/\-]\d{2,4}$/i.test(str)) return null;
  if (/^[a-zA-Záéíóúâêîôûãõ]+[\/\-]\d{4}$/i.test(str)) return null;
  
  // Remove currency symbols, letters, and various whitespace
  str = str.replace(/[R$¤€£¥a-zA-Z]/gi, "");
  
  // Remove invisible characters (non-breaking space, narrow no-break space, figure space)
  str = str.replace(/[\u00A0\u2007\u202F\u200B\uFEFF]/g, "");
  
  // Remove regular spaces
  str = str.replace(/\s+/g, "");
  
  // After cleanup, check if empty or just a dash
  if (!str || str === "-" || str === "+" || str === "--") return null;
  
  // Detect negative by parentheses: (1.234,56) -> -1234.56
  const isNegativeParens = str.startsWith("(") && str.endsWith(")");
  if (isNegativeParens) {
    str = str.slice(1, -1);
  }
  
  // Detect negative by prefix or suffix dash
  const isNegativePrefix = str.startsWith("-");
  const isNegativeSuffix = str.endsWith("-");
  str = str.replace(/^-+|-+$/g, "");
  
  // After removing signs, check if empty
  if (!str) return null;
  
  // Determine format: BR (1.234,56) vs US (1,234.56)
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
      if (afterComma && afterComma.length <= 2) {
        normalized = str.replace(",", ".");
      } else {
        normalized = str.replace(",", "");
      }
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

/**
 * Check if a row should be skipped (not an error!)
 */
function isSkippableRow(
  rowObj: Record<string, unknown>,
  description: string
): { skip: boolean; reason?: keyof SkipBreakdown } {
  const descLower = (description || "").toLowerCase().trim();
  
  // Skip total/subtotal/summary rows
  const totalKeywords = ["total", "subtotal", "saldo", "soma", "acumulado", "resumo", "balanço", "balanco", "sum", "balance"];
  if (totalKeywords.some(k => descLower.includes(k))) {
    return { skip: true, reason: "total_row" };
  }
  
  // Check if row looks like repeated headers
  const allValues = Object.values(rowObj).map(v => String(v || "").toLowerCase().trim());
  const headerKeywords = ["data", "date", "valor", "value", "descrição", "descricao", "description", "categoria", "category", "tipo", "type"];
  const headerMatchCount = headerKeywords.filter(k => 
    allValues.some(v => v === k || v.includes(k))
  ).length;
  
  if (headerMatchCount >= 2) {
    return { skip: true, reason: "header_row" };
  }
  
  // Check if row is completely empty
  const hasAnyContent = allValues.some(v => v && v.length > 0);
  if (!hasAnyContent) {
    return { skip: true, reason: "empty" };
  }
  
  return { skip: false };
}

/**
 * Parse date from various formats with fallback
 */
function parseDate(value: string | number | null | undefined): string | null {
  if (!value) return null;
  
  // Excel serial date
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
  
  // DD/MM/YYYY (Brazilian format - most common)
  const brMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (brMatch) {
    const day = parseInt(brMatch[1]);
    const month = parseInt(brMatch[2]);
    const year = parseInt(brMatch[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  
  // DD/MM/YY (2-digit year)
  const brMatch2 = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (brMatch2) {
    const day = parseInt(brMatch2[1]);
    const month = parseInt(brMatch2[2]);
    let year = parseInt(brMatch2[3]);
    year = year > 50 ? 1900 + year : 2000 + year; // 50+ = 1900s, else 2000s
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  
  // YYYY-MM-DD (ISO format)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return str;
  }
  
  // Month name formats (e.g., "Jan 2024", "Janeiro/2024")
  const monthNames: Record<string, number> = {
    jan: 1, janeiro: 1, january: 1,
    fev: 2, fevereiro: 2, february: 2, feb: 2,
    mar: 3, março: 3, marco: 3, march: 3,
    abr: 4, abril: 4, april: 4, apr: 4,
    mai: 5, maio: 5, may: 5,
    jun: 6, junho: 6, june: 6,
    jul: 7, julho: 7, july: 7,
    ago: 8, agosto: 8, august: 8, aug: 8,
    set: 9, setembro: 9, september: 9, sep: 9,
    out: 10, outubro: 10, october: 10, oct: 10,
    nov: 11, novembro: 11, november: 11,
    dez: 12, dezembro: 12, december: 12, dec: 12,
  };
  
  const monthMatch = str.toLowerCase().match(/([a-záéíóúâêîôûãõ]+)[\/\-\s]+(\d{4})/);
  if (monthMatch) {
    const monthNum = monthNames[monthMatch[1]];
    const year = parseInt(monthMatch[2]);
    if (monthNum && year >= 1900 && year <= 2100) {
      return `${year}-${String(monthNum).padStart(2, "0")}-01`;
    }
  }
  
  return null;
}

/**
 * Check if a string looks like a date
 */
function looksLikeDate(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return true;
  if (/^\d{1,2}[\/\-][a-zA-Záéíóúâêîôûãõ]+[\/\-]\d{2,4}$/i.test(str)) return true;
  return false;
}

/**
 * Normalize row object keys by trimming whitespace
 */
function normalizeRowKeys(rowObj: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rowObj)) {
    normalized[key] = value;
    const trimmed = key.trim();
    if (trimmed !== key) {
      normalized[trimmed] = value;
    }
  }
  return normalized;
}

/**
 * Auto-detect column mapping with extended synonyms for PT-BR
 * FIXED: prevents same column mapping to multiple fields, refined keywords
 */
function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedColumnIndices = new Set<number>();
  
  const normalizedHeaders = headers.map(h => 
    (h || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  );
  
  // Order matters: map high-priority fields first to prevent conflicts
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
      // NEVER map same column to two different fields
      if (usedColumnIndices.has(i)) continue;
      
      const header = normalizedHeaders[i];
      if (!header) continue;
      
      // Use word-boundary matching to avoid "banco" matching "credito" etc.
      const matched = keywords.some(k => {
        // Exact match
        if (header === k) return true;
        // Word boundary: header contains keyword as a standalone word
        const regex = new RegExp(`\\b${k}\\b`);
        if (regex.test(header)) return true;
        // Also allow if header starts with keyword
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

// ============ Density-Based Amount Column Detection ============
function detectAmountByDensity(
  headers: string[],
  dataRows: unknown[][],
  mapping: Record<string, string>,
  requestId: string
): void {
  if (mapping.amount || mapping.credit || mapping.debit) return;

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
    const headerKey = headers[bestColIdx] && String(headers[bestColIdx]).trim()
      ? headers[bestColIdx]
      : `__col_${bestColIdx}`;
    mapping.amount = headerKey;
    if (!headers[bestColIdx] || !String(headers[bestColIdx]).trim()) {
      headers[bestColIdx] = headerKey;
    }
    console.log(`[${requestId}] DENSITY FALLBACK: col ${bestColIdx} detected as amount (density=${(bestDensity * 100).toFixed(0)}%)`);
  }
}

/**
 * Extract amount and type from row, supporting both single amount column
 * and separate credit/debit columns
 */
function extractAmount(
  rowObj: Record<string, unknown>,
  mapping: Record<string, string>
): { value: number | null; type: "income" | "expense" } {
  // Normalize row keys to handle " Valor " -> "Valor"
  const nRow = normalizeRowKeys(rowObj);
  
  // PRIORITY 1: Try single amount column FIRST (most reliable)
  if (mapping.amount) {
    const raw = nRow[mapping.amount] ?? nRow[mapping.amount.trim()];
    if (raw !== null && raw !== undefined && !looksLikeDate(raw)) {
      const parsed = parseBRL(raw as string | number | null);
      if (parsed !== null) {
        // Check if there's an explicit type column
        const typeCol = mapping.type;
        if (typeCol) {
          const typeRaw = nRow[typeCol] ?? nRow[typeCol.trim()];
          if (typeRaw) {
            const typeValue = String(typeRaw).toLowerCase().trim();
            if (typeValue.includes("entrada") || typeValue.includes("receita") || 
                typeValue.includes("credito") || typeValue.includes("crédito") ||
                typeValue === "c" || typeValue === "r" || typeValue === "+") {
              return { value: Math.abs(parsed), type: "income" };
            }
            if (typeValue.includes("saida") || typeValue.includes("saída") || 
                typeValue.includes("despesa") || typeValue.includes("debito") ||
                typeValue.includes("débito") || typeValue === "d" || typeValue === "-") {
              return { value: Math.abs(parsed), type: "expense" };
            }
          }
        }
        return {
          value: Math.abs(parsed),
          type: parsed >= 0 ? "income" : "expense"
        };
      }
    }
  }
  
  // PRIORITY 2: Try credit/debit columns (only if amount didn't work)
  if (mapping.credit || mapping.debit) {
    const creditRaw = mapping.credit ? (nRow[mapping.credit] ?? nRow[mapping.credit.trim()]) : null;
    const debitRaw = mapping.debit ? (nRow[mapping.debit] ?? nRow[mapping.debit.trim()]) : null;
    
    // GUARD: reject values that look like dates
    if (looksLikeDate(creditRaw) || looksLikeDate(debitRaw)) {
      // Date detected in credit/debit column - mapping is wrong, skip
      return { value: null, type: "income" };
    }
    
    const credit = parseBRL(creditRaw as string | number | null) || 0;
    const debit = parseBRL(debitRaw as string | number | null) || 0;
    
    if (credit > 0 && debit === 0) {
      return { value: credit, type: "income" };
    }
    if (debit > 0 && credit === 0) {
      return { value: debit, type: "expense" };
    }
    if (credit > 0 && debit > 0) {
      const net = credit - debit;
      return { 
        value: Math.abs(net), 
        type: net >= 0 ? "income" : "expense" 
      };
    }
  }
  
  // NO "last resort scan" - it's dangerous and causes the date-as-value bug
  return { value: null, type: "income" };
}

// ============ Bank Balance Helpers ============

const MONTH_MAP: Record<string, string> = {
  jan: "01", janeiro: "01", january: "01",
  fev: "02", fevereiro: "02", february: "02", feb: "02",
  mar: "03", março: "03", marco: "03", march: "03",
  abr: "04", abril: "04", april: "04", apr: "04",
  mai: "05", maio: "05", may: "05",
  jun: "06", junho: "06", june: "06",
  jul: "07", julho: "07", july: "07",
  ago: "08", agosto: "08", august: "08", aug: "08",
  set: "09", setembro: "09", september: "09", sep: "09",
  out: "10", outubro: "10", october: "10", oct: "10",
  nov: "11", novembro: "11", november: "11",
  dez: "12", dezembro: "12", december: "12", dec: "12",
};

/** Derive YYYY-MM from tab name like "Mar2026", "Jan26", "Fevereiro2026" */
function derivePeriodKey(tabName: string): string {
  const normalized = tabName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Try pattern: MonthYear (e.g. Mar2026, Jan26, Fevereiro2026)
  const m = normalized.match(/^([a-z]+)\s*(\d{2,4})$/);
  if (m) {
    const monthNum = MONTH_MAP[m[1]];
    if (monthNum) {
      let year = m[2];
      if (year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }
      return `${year}-${monthNum}`;
    }
  }
  // Fallback: current month
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

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
    if (isNaN(Number(cleaned))) {
      const norm = col0.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const matchesKnown = knownBanks.some(b => norm.includes(b) || norm === b);
      const col1 = parseBRL(row[1]);
      const col2 = parseBRL(row[2]);
      if ((col1 !== null || col2 !== null) && (matchesKnown || norm.length >= 3)) return true;
    }
  }
  return false;
}

/** Read bank balance block from dedicated ranges — tries G-I first (StarSync), then H-J (GR) */
async function readBankBalanceRange(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
  requestId: string,
): Promise<string[][]> {
  const ranges = [
    `'${tabTitle}'!G2:I4`, `'${tabTitle}'!G1:I20`,
    `'${tabTitle}'!H3:J5`, `'${tabTitle}'!H1:J20`,
  ];
  for (const range of ranges) {
    try {
      const resp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!resp.ok) {
        console.warn(`[${requestId}] [bank-balance] fetch ${range} failed: ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      const vals: string[][] = data.values || [];
      if (vals.length > 0) {
        console.log(`[${requestId}] [bank-balance] range=${range} rows=${vals.length}`);
        if (isValidBankBalanceData(vals)) {
          return vals;
        }
        console.log(`[${requestId}] [bank-balance] range=${range} failed validation, trying next`);
        continue;
      }
    } catch (e) {
      console.warn(`[${requestId}] [bank-balance] error fetching ${range}:`, e);
    }
  }
  return [];
}

/** Extract bank balances from 3-column H-J data */
function extractBankBalances(
  rows: string[][],
  requestId: string,
): Array<{ bank_name: string; opening: number | null; closing: number | null }> {
  const results: Array<{ bank_name: string; opening: number | null; closing: number | null }> = [];

  // Find data start: skip header/anchor rows
  let startIdx = 0;
  for (let i = 0; i < rows.length; i++) {
    const joined = (rows[i] || []).map(c => String(c || "").toLowerCase().trim()).join(" ");
    if (joined.includes("saldo banc") || joined.includes("saldo inicial") || joined.includes("banco")) {
      startIdx = i + 1;
      break;
    }
  }
  // If no header found, assume first row is header if it looks textual
  if (startIdx === 0 && rows.length > 1) {
    const firstCell = String(rows[0]?.[0] || "").trim().toLowerCase();
    if (firstCell && parseBRL(firstCell) === null) {
      startIdx = 1; // first row is header
    }
  }

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i] || [];
    const bankName = String(row[0] || "").trim();
    if (!bankName) break; // stop at first empty bank name

    const rawOpening = parseBRL(row[1]);
    const rawClosing = parseBRL(row[2]);
    const opening = rawOpening !== null ? Math.round(rawOpening * 100) / 100 : null;
    const closing = rawClosing !== null ? Math.round(rawClosing * 100) / 100 : null;

    console.log(`[${requestId}] [bank-balance] "${bankName}" raw=[${row[1]}, ${row[2]}] parsed=[${rawOpening}, ${rawClosing}] rounded=[${opening}, ${closing}]`);

    if (opening === null && closing === null) {
      console.warn(`[${requestId}] [bank-balance] skipping "${bankName}": no valid values`);
      continue;
    }

    results.push({ bank_name: bankName, opening, closing });
  }

  return results;
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
      // Detect file type (native Google Sheets vs .xlsx)
      const fileInfo = await getFileMimeType(accessToken!, connection.spreadsheet_id);
      const isXlsx = fileInfo.mimeType === XLSX_MIME;
      console.log(`[${requestId}] File type: ${fileInfo.mimeType} (xlsx=${isXlsx})`);

      let googleRevision: string | null = null;
      let values: string[][] = [];

      if (isXlsx) {
        // Download and parse xlsx via Drive API + SheetJS
        const workbook = await downloadXlsxWorkbook(accessToken!, connection.spreadsheet_id);
        const targetSheet = connection.sheet_name || workbook.SheetNames[0];
        values = xlsxSheetToRows(workbook, targetSheet);
        console.log(`[${requestId}] Parsed xlsx sheet "${targetSheet}": ${values.length} rows`);
      } else {
        // Native Google Sheets flow
        const metaResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}?fields=properties.modifiedTime`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (metaResponse.ok) {
          const metaData = await metaResponse.json();
          googleRevision = metaData.properties?.modifiedTime || null;
        }

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
        values = sheetsData.values || [];
      }

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
        // Density-based fallback for amount column (handles empty headers)
        detectAmountByDensity(headers, rows, mapping, requestId);
        console.log(`[${requestId}] Auto-detected mapping:`, mapping);
        
        await supabase
          .from("google_sheet_connections")
          .update({ column_mapping: mapping })
          .eq("id", connection_id);
      }

      // If preview only, return sample data
      if (preview_only) {
        const sampleRows = rows.slice(0, 10).map((row, idx) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            obj[h] = row[i] || "";
          });
          const { value, type } = extractAmount(obj, mapping);
          return {
            row_number: idx + 2,
            raw: obj,
            parsed_amount: value,
            parsed_type: type,
            skip_check: isSkippableRow(obj, String(obj[mapping.description] || "")),
          };
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
        rows_skipped: 0,
        rows_failed: 0,
        errors: [],
        skip_breakdown: {
          empty: 0,
          total_row: 0,
          header_row: 0,
          zero_value: 0,
          no_date: 0,
        },
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
            const key = String(h || "").trim() || `__col_${i}`;
            rowObj[key] = row[i] || "";
          });

          // Extract description
          const description = mapping.description 
            ? String(rowObj[mapping.description] || "").trim() 
            : "";

          // Check if row should be skipped (NOT an error!)
          const skipCheck = isSkippableRow(rowObj, description);
          if (skipCheck.skip && skipCheck.reason) {
            result.rows_skipped++;
            result.skip_breakdown[skipCheck.reason]++;
            continue;
          }

          // Extract amount and type
          const { value: amount, type } = extractAmount(rowObj, mapping);

          // Skip rows with no valid amount (but don't count as error)
          if (amount === null || amount === 0) {
            result.rows_skipped++;
            result.skip_breakdown.zero_value++;
            continue;
          }

          // Extract and validate date
          const dateRaw = mapping.date ? rowObj[mapping.date] : null;
          const date = parseDate(dateRaw as string | number | null);
          
          // Use today as fallback for missing dates (don't fail!)
          const finalDate = date || new Date().toISOString().split("T")[0];
          
          // If date is missing but we have valid amount, count as skipped (can be reviewed)
          // Actually, let's import with today's date to avoid losing data
          if (!date) {
            console.log(`[${requestId}] Row ${rowNumber}: No valid date, using today as fallback`);
          }

          // Extract other fields with defaults
          const category = mapping.category 
            ? String(rowObj[mapping.category] || "").trim() || "Geral"
            : "Geral";
          const clientVendor = mapping.client_vendor 
            ? String(rowObj[mapping.client_vendor] || "").trim() || null
            : null;

          // Generate idempotent key: tab:rowNumber:hash
          const rowHash = generateRowHash({
            description,
            amount,
            date: finalDate,
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
            date: finalDate,
            type,
            category,
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
              result.errors.push({ row: rowNumber, error: updateError.message, raw: rowObj });
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
                result.errors.push({ row: rowNumber, error: insertError.message, raw: rowObj });
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

      // Update sync log with detailed metrics
      if (syncLog) {
        await supabase
          .from("google_sheet_sync_logs")
          .update({
            rows_processed: result.rows_read,
            rows_imported: result.rows_upserted - result.rows_updated,
            rows_upserted: result.rows_upserted,
            rows_updated: result.rows_updated,
            rows_skipped: result.rows_skipped,
            errors: result.errors.slice(0, 50),
            error_details: {
              errors: result.errors,
              skip_breakdown: result.skip_breakdown,
            },
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

      console.log(`[${requestId}] Sync completed: read=${result.rows_read}, upserted=${result.rows_upserted}, skipped=${result.rows_skipped}, failed=${result.rows_failed}`);
      console.log(`[${requestId}] Skip breakdown:`, result.skip_breakdown);

      // ===== BANK BALANCES EXTRACTION (soft fail — never blocks transactions) =====
      try {
        const tabName = connection.sheet_name || "Sheet1";
        const periodKey = derivePeriodKey(tabName);
        console.log(`[${requestId}] [bank-balance] tab=${tabName} period_key=${periodKey}`);

        let bankBalanceRows: string[][] = [];

        if (isXlsx) {
          // For xlsx: try G-I columns (indices 6-8) first, then H-J (indices 7-9)
          const topRows = values.slice(0, 21);
          const giRows = topRows.map(r => [String(r[6] ?? ""), String(r[7] ?? ""), String(r[8] ?? "")]);
          const hjRows = topRows.map(r => [String(r[7] ?? ""), String(r[8] ?? ""), String(r[9] ?? "")]);
          if (isValidBankBalanceData(giRows)) {
            bankBalanceRows = giRows;
            console.log(`[${requestId}] [bank-balance] xlsx using G-I columns (StarSync layout)`);
          } else {
            bankBalanceRows = hjRows;
            console.log(`[${requestId}] [bank-balance] xlsx using H-J columns (GR layout)`);
          }
        } else if (accessToken) {
          bankBalanceRows = await readBankBalanceRange(accessToken, connection.spreadsheet_id, tabName, requestId);
        }

        if (bankBalanceRows.length > 0) {
          const extracted = extractBankBalances(bankBalanceRows, requestId);
          console.log(`[${requestId}] [bank-balance] extracted ${extracted.length} bank(s)`);

          if (extracted.length > 0) {
            for (const bank of extracted) {
              const { error: upsertErr } = await supabase
                .from("bank_balances")
                .upsert({
                  user_id: userId,
                  connection_id: connection_id,
                  period_key: periodKey,
                  bank_name: bank.bank_name,
                  opening_balance: bank.opening,
                  closing_balance: bank.closing,
                  tab_name: tabName,
                  updated_at: new Date().toISOString(),
                }, { onConflict: "user_id,connection_id,period_key,bank_name" });

              if (upsertErr) {
                console.warn(`[${requestId}] [bank-balance] upsert error for ${bank.bank_name}:`, upsertErr.message);
              }
            }

            // Confirm persistence
            const { count } = await supabase
              .from("bank_balances")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("connection_id", connection_id)
              .eq("period_key", periodKey);
            console.log(`[${requestId}] [bank-balance] confirmed persisted count=${count} period=${periodKey}`);
          }
        } else {
          console.log(`[${requestId}] [bank-balance] no data found in H-J range`);
        }
      } catch (bankErr: unknown) {
        const msg = bankErr instanceof Error ? bankErr.message : String(bankErr);
        console.warn(`[${requestId}] [bank-balance] extraction failed (non-blocking): ${msg}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          rows_processed: result.rows_read,
          rows_imported: result.rows_upserted,
          rows_skipped: result.rows_skipped,
          rows_failed: result.rows_failed,
          skip_breakdown: result.skip_breakdown,
          errors: result.errors.slice(0, 20),
          sync_run_id: result.sync_run_id,
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
