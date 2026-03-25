import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

// ========== HELPERS ==========

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function slugify(text: string): string {
  return normalize(text).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parseBRL(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  let str = String(value).trim();
  if (!str) return null;
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  // Handle #N/A, #REF!, #VALUE! etc
  if (str.startsWith("#")) return null;

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

  let normalized = str;
  if (lastComma > lastDot) {
    normalized = str.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = str.replace(/,/g, "");
  } else if (lastComma >= 0 && lastDot === -1) {
    const afterComma = str.split(",")[1];
    if (afterComma && afterComma.length <= 2) {
      normalized = str.replace(",", ".");
    } else {
      normalized = str.replace(/,/g, "");
    }
  }

  const num = parseFloat(normalized);
  if (isNaN(num)) return null;
  const isNeg = isNegativeParens || isNegativePrefix || isNegativeSuffix;
  return isNeg ? -num : num;
}

function parseBRLFromCells(row: any[], colIndex: number): number | null {
  const cell = row?.[colIndex];
  const parsed = parseBRL(cell);
  if (parsed !== null) return parsed;
  const cellStr = String(cell ?? "").trim();
  if (/^R\$?\s*-?$/.test(cellStr) || cellStr === "R$") {
    const nextVal = parseBRL(row?.[colIndex + 1]);
    if (nextVal !== null) return nextVal;
  }
  return null;
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
  if (!response.ok) throw new Error("Failed to refresh access token");
  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  return { access_token: data.access_token, expires_at: expiresAt };
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

function colToLetter(col: number): string {
  let result = "";
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

// ========== MONTH DETECTION ==========

const MONTH_ABBREVS: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function parseMonthHeader(raw: string): { periodKey: string; label: string } | null {
  const label = raw.trim();
  if (!label) return null;
  const norm = normalize(label);

  if (norm === "total") return { periodKey: "TOTAL", label };

  const m1 = norm.match(/^([a-z]{3,})\.?\s*[\/\-\s]\s*(\d{2,4})$/);
  if (m1) {
    const monthNum = MONTH_ABBREVS[m1[1]];
    if (monthNum) {
      const year = m1[2].length === 2 ? (parseInt(m1[2]) > 50 ? `19${m1[2]}` : `20${m1[2]}`) : m1[2];
      return { periodKey: `${year}-${monthNum}`, label };
    }
  }

  const m2 = norm.match(/^(\d{1,2})[\/\-](\d{2,4})$/);
  if (m2) {
    const month = m2[1].padStart(2, "0");
    const year = m2[2].length === 2 ? (parseInt(m2[2]) > 50 ? `19${m2[2]}` : `20${m2[2]}`) : m2[2];
    if (parseInt(month) >= 1 && parseInt(month) <= 12) {
      return { periodKey: `${year}-${month}`, label };
    }
  }

  const serial = parseFloat(norm);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const date = new Date((serial - 25569) * 86400000);
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const mStr = String(m + 1).padStart(2, "0");
    const MONTH_NAMES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const friendlyLabel = `${MONTH_NAMES_PT[m]}/${y}`;
    return { periodKey: `${y}-${mStr}`, label: friendlyLabel };
  }

  const m3 = norm.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (m3) {
    return { periodKey: `${m3[1]}-${m3[2]}`, label };
  }

  return null;
}

// ========== YEAR EXTRACTION ==========

function extractYearFromTab(tabName: string, rows: string[][]): number | null {
  // 1. Tab name: "DRE 2026", "2026 DRE", "DRE-Caixa" etc
  const yearMatch = tabName.match(/\b(20\d{2})\b/);
  if (yearMatch) return parseInt(yearMatch[1]);

  // 2. Month headers in first 10 rows
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    for (const cell of rows[r]) {
      if (!cell) continue;
      const parsed = parseMonthHeader(String(cell));
      if (parsed && parsed.periodKey !== "TOTAL") {
        const y = parseInt(parsed.periodKey.split("-")[0]);
        if (y >= 2020 && y <= 2030) return y;
      }
    }
  }

  // 3. Serial dates in headers
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    for (const cell of rows[r]) {
      const n = parseFloat(String(cell ?? ""));
      if (!isNaN(n) && n > 40000 && n < 60000) {
        const date = new Date((n - 25569) * 86400000);
        return date.getUTCFullYear();
      }
    }
  }

  return null;
}

// ========== TAB SCORING ==========

const NON_DRE_PATTERNS = [
  "fluxo", "dashboard", "contas a pagar", "contas a receber",
  "balanco", "balanço", "config", "resumo", "controle",
  "saldo", "teste", "testes", "template", "modelo",
];

function scoreDreTab(tabName: string, rows: string[][]): number {
  let score = 0;
  const norm = normalize(tabName);

  // Year bonus
  if (norm.includes("2026")) score += 100;
  else if (norm.includes("2025")) score += 50;
  else if (norm.includes("2024")) score += 30;

  // DRE keyword
  if (norm.includes("dre")) score += 80;

  // Non-DRE penalty
  if (NON_DRE_PATTERNS.some(p => norm.includes(p) && !norm.includes("dre"))) score -= 100;

  // Month headers bonus
  const year = extractYearFromTab(tabName, rows);
  if (year === 2026) score += 60;
  else if (year === 2025) score += 30;

  // TOTAL column bonus
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    for (const cell of rows[r]) {
      if (normalize(String(cell ?? "")) === "total") { score += 40; break; }
    }
  }

  return score;
}

// ========== SUBTOTAL DETECTION ==========

const SUBTOTAL_KEYWORDS = [
  "receita liquida", "resultado", "despesas totais", "lucro bruto",
  "ebitda", "resultado mes", "resultado do mes", "total despesas",
  "resultado operacional", "resultado liquido", "lucro liquido",
  "total geral", "resultado final", "lucro operacional",
  "faturamento", "deducoes", "custos totais", "custos diretos",
  "receita bruta total", "receita bruta", "cmv", "custo de venda",
  "custos de venda", "distribuicao de lucro", "distribuicao",
  "resultado do exercicio",
];

function isSubtotalLabel(label: string): boolean {
  const norm = normalize(label);
  return SUBTOTAL_KEYWORDS.some(kw => norm.includes(kw));
}

function isGroupLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  const letters = trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true;
  return false;
}

// ========== DRE TAB DETECTION ==========

function listCandidateDreSheets(sheetTitles: string[]): string[] {
  return sheetTitles.filter(t => {
    const n = normalize(t);
    return n.includes("dre");
  });
}

function detectDreTemplate(rows: string[][]): "LCF_NUCLEO" | "DEFAULT" {
  let hasReceitaBruta = false;
  let hasDespesasNucleo = false;
  let hasNucleoAmbiental = false;
  let hasNucleoPenal = false;

  const searchRows = rows.slice(0, 30);
  for (const row of searchRows) {
    for (const cell of row) {
      if (!cell) continue;
      const n = normalize(String(cell));
      if (n.includes("receita bruta total")) hasReceitaBruta = true;
      if (n.includes("despesas totais") && n.includes("nucleo")) hasDespesasNucleo = true;
      if (n.includes("nucleo ambiental") || n === "ambiental") hasNucleoAmbiental = true;
      if (n.includes("nucleo penal") || n === "penal") hasNucleoPenal = true;
    }
  }

  if (hasReceitaBruta && (hasDespesasNucleo || (hasNucleoAmbiental && hasNucleoPenal))) {
    return "LCF_NUCLEO";
  }
  return "DEFAULT";
}

function extractPeriodFromTabName(tabName: string): string | null {
  const norm = normalize(tabName).replace("dre", "").trim();
  if (!norm) return null;

  const m1 = norm.match(/^([a-z]{3,})\.?\s*[\/\-\s]?\s*(\d{2,4})$/);
  if (m1) {
    const monthNum = MONTH_ABBREVS[m1[1]];
    if (monthNum) {
      const year = m1[2].length === 2 ? `20${m1[2]}` : m1[2];
      return `${year}-${monthNum}`;
    }
  }

  const m2 = norm.match(/^(\d{1,2})[\/\-]\s*(\d{2,4})$/);
  if (m2) {
    const month = m2[1].padStart(2, "0");
    const year = m2[2].length === 2 ? `20${m2[2]}` : m2[2];
    if (parseInt(month) >= 1 && parseInt(month) <= 12) {
      return `${year}-${month}`;
    }
  }

  return null;
}

function extractPeriodFromContent(rows: string[][]): string | null {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    for (const cell of rows[i]) {
      if (!cell) continue;
      const s = String(cell).trim();
      const parsed = parseMonthHeader(s);
      if (parsed && parsed.periodKey !== "TOTAL") return parsed.periodKey;
    }
  }
  return null;
}

// ========== MATRIX DRE FORMAT DETECTION (Format C - Baladão & Fagundes) ==========

const MATRIX_DRE_STOP_KEYWORDS = [
  "fluxo de caixa", "saldo bancario", "saldo banco",
];

const MATRIX_EXCLUDE_KEYWORDS = [
  "chris", "michelle", "denise", "controle denise", "total denise",
  "total recebido direto", "total a receber", "rateio", "comissao",
  "participacao", "participacoes",
];

interface MatrixDetectResult {
  isMatrix: boolean;
  headerRowIndex: number;
  labelColIndex: number;
  monthCols: Array<{ colIndex: number; periodKey: string; label: string }>;
  totalColIndex: number;
}

function detectDreMatrix(rows: string[][]): MatrixDetectResult {
  const fail: MatrixDetectResult = { isMatrix: false, headerRowIndex: -1, labelColIndex: 0, monthCols: [], totalColIndex: -1 };
  
  let hasFaturamento = false;
  let hasDeducoes = false;
  let hasReceitaLiquida = false;
  let hasDespesasTotais = false;
  let hasLucroOperacional = false;

  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const firstCell = normalize(String(rows[r]?.[0] ?? ""));
    if (firstCell.includes("faturamento")) hasFaturamento = true;
    if (firstCell.includes("deducoe") || firstCell.includes("deducao")) hasDeducoes = true;
    if (firstCell.includes("receita liquida")) hasReceitaLiquida = true;
    if (firstCell.includes("despesas totais") || firstCell.includes("total despesas")) hasDespesasTotais = true;
    if (firstCell.includes("lucro operacional") || firstCell.includes("resultado operacional")) hasLucroOperacional = true;
  }

  for (let rowIdx = 0; rowIdx < Math.min(rows.length, 20); rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;
    
    const candidates: Array<{ colIndex: number; periodKey: string; label: string }> = [];
    let foundTotal = -1;

    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const val = String(row[colIdx] ?? "").trim();
      if (!val) continue;
      const n = normalize(val);
      
      if (n === "total") { foundTotal = colIdx; continue; }
      
      const parsed = parseMonthHeader(val);
      if (parsed && parsed.periodKey !== "TOTAL") {
        candidates.push({ colIndex: colIdx, periodKey: parsed.periodKey, label: parsed.label });
      }
    }

    if (candidates.length >= 2) {
      // Scan adjacent row (headerRow+1) for additional month columns and TOTAL
      const nextRow = rows[rowIdx + 1];
      if (nextRow) {
        for (let colIdx = 0; colIdx < nextRow.length; colIdx++) {
          const val = String(nextRow[colIdx] ?? "").trim();
          if (!val) continue;
          const n = normalize(val);
          if (n === "total" && foundTotal < 0) { foundTotal = colIdx; continue; }
          const parsed = parseMonthHeader(val);
          if (parsed && parsed.periodKey !== "TOTAL" && !candidates.some(c => c.colIndex === colIdx)) {
            candidates.push({ colIndex: colIdx, periodKey: parsed.periodKey, label: parsed.label });
          }
        }
      }

      const firstMonthCol = Math.min(...candidates.map(c => c.colIndex));
      let labelCol = firstMonthCol > 0 ? firstMonthCol - 1 : 0;
      
      const possibleRsCol = normalize(String(row[labelCol] ?? ""));
      if (possibleRsCol === "r$" || possibleRsCol === "") {
        labelCol = Math.max(0, labelCol - 1);
      }

      return {
        isMatrix: true,
        headerRowIndex: rowIdx,
        labelColIndex: labelCol,
        monthCols: candidates.sort((a, b) => a.colIndex - b.colIndex),
        totalColIndex: foundTotal,
      };
    }
  }

  return fail;
}

// ========== MATRIX DRE PARSER (Format C - existing Baladão) ==========

async function parseDreMatrix(
  rows: string[][],
  dreTab: string,
  userId: string,
  connectionId: string,
  supabase: any,
  detection: MatrixDetectResult,
  skipCleanup = false,
  yearOverride?: number,
) {
  const { headerRowIndex, labelColIndex, monthCols, totalColIndex } = detection;
  
  const dreYear = yearOverride || extractYearFromTab(dreTab, rows);
  console.log(`[dre-sync] Matrix DRE: tab="${dreTab}", year=${dreYear}, header at row ${headerRowIndex}, ${monthCols.length} months`);

  // Year-scope the TOTAL key
  const totalPeriodKey = dreYear ? `${dreYear}-TOTAL` : "TOTAL";

  const periodColumns = [
    ...monthCols.map(m => ({ colIndex: m.colIndex, periodKey: m.periodKey, periodLabel: m.label })),
  ];
  if (totalColIndex >= 0) {
    periodColumns.push({ colIndex: totalColIndex, periodKey: totalPeriodKey, periodLabel: `TOTAL ${dreYear || ""}`.trim() });
  }
  
  const allValueCols = periodColumns.map(p => p.colIndex);

  interface ParsedLine {
    label: string;
    rowIndex: number;
    isGroup: boolean;
    isSubtotal: boolean;
    groupLabel: string | null;
    values: Map<number, number>;
  }

  const parsedLines: ParsedLine[] = [];
  let currentGroup: string | null = null;
  let reachedStop = false;

  for (let rowIdx = headerRowIndex + 1; rowIdx < rows.length; rowIdx++) {
    if (reachedStop) break;

    const row = rows[rowIdx];
    let label = String(row?.[labelColIndex] ?? "").trim();
    if (!label && labelColIndex > 0) {
      label = String(row?.[labelColIndex - 1] ?? "").trim();
    }
    if (!label && labelColIndex + 1 < (row?.length ?? 0)) {
      label = String(row?.[labelColIndex + 1] ?? "").trim();
    }
    if (!label) continue;

    const normLabel = normalize(label);
    
    if (MATRIX_EXCLUDE_KEYWORDS.some(kw => normLabel.includes(kw))) continue;
    if (/^R\$?\s*$/.test(label)) continue;
    if (/^DRE\s+\d{4}/i.test(label)) continue;
    if (/^%/.test(label.trim())) continue;

    const isGroup = isGroupLabel(label);
    const isSubtotal = isSubtotalLabel(label);
    if (isGroup) currentGroup = label;

    const values = new Map<number, number>();
    let hasAnyValue = false;
    for (const colIdx of allValueCols) {
      const parsed = parseBRLFromCells(row, colIdx);
      if (parsed !== null) { values.set(colIdx, parsed); hasAnyValue = true; }
    }
    
    if (!hasAnyValue && !isGroup) continue;

    parsedLines.push({ label, rowIndex: rowIdx, isGroup, isSubtotal, groupLabel: isGroup ? label : currentGroup, values });

    if (MATRIX_DRE_STOP_KEYWORDS.some(kw => normLabel.includes(kw))) {
      reachedStop = true;
    }
  }

  // Auto-calculate TOTAL for lines where TOTAL cell is empty but month values exist
  if (totalColIndex >= 0) {
    const monthColIndices = monthCols.map(m => m.colIndex);
    for (const line of parsedLines) {
      if (!line.values.has(totalColIndex)) {
        let sum = 0;
        let hasMonthValue = false;
        for (const mci of monthColIndices) {
          const v = line.values.get(mci);
          if (v !== undefined) { sum += v; hasMonthValue = true; }
        }
        if (hasMonthValue) {
          line.values.set(totalColIndex, Math.round(sum * 100) / 100);
        }
      }
    }
  }

  if (parsedLines.length === 0) {
    return { success: false, found: true, message: "DRE matricial detectada mas sem linhas válidas." };
  }

  console.log(`[dre-sync] Matrix: parsed ${parsedLines.length} lines for ${periodColumns.length} periods`);

  // Year-scoped cleanup: only delete periods matching this year
  if (!skipCleanup) {
    const { data: oldPeriods } = await supabase
      .from("dre_periods")
      .select("id, period_key")
      .eq("user_id", userId)
      .eq("sheet_id", connectionId)
      .eq("template_type", "DEFAULT");

    if (oldPeriods && oldPeriods.length > 0) {
      // Filter to only periods matching our year
      const yearStr = dreYear ? String(dreYear) : null;
      const periodsToDelete = yearStr
        ? oldPeriods.filter((p: any) => p.period_key.startsWith(yearStr) || p.period_key === "TOTAL")
        : oldPeriods;
      
      if (periodsToDelete.length > 0) {
        const oldIds = periodsToDelete.map((p: any) => p.id);
        await supabase.from("dre_validation_issues").delete().in("period_id", oldIds);
        await supabase.from("dre_lines").delete().in("period_id", oldIds);
        await supabase.from("dre_periods").delete().in("id", oldIds);
      }
    }
  }

  // Insert periods
  const periodInserts = periodColumns.map(pc => ({
    user_id: userId,
    sheet_id: connectionId,
    period_key: pc.periodKey,
    period_label: pc.periodLabel,
    col_index: pc.colIndex,
    validation_status: "ok",
    validation_notes: [],
    last_import_at: new Date().toISOString(),
    template_type: "DEFAULT",
    scenario: null,
  }));

  const { data: insertedPeriods, error: periodError } = await supabase
    .from("dre_periods").insert(periodInserts).select("id, period_key, col_index");
  if (periodError) throw new Error(`Failed to insert periods: ${periodError.message}`);

  const periodMap = new Map<string, { id: string; colIndex: number }>();
  for (const p of insertedPeriods || []) {
    periodMap.set(p.period_key, { id: p.id, colIndex: p.col_index });
  }

  const periodIds = (insertedPeriods || []).map((p: any) => p.id);
  if (periodIds.length > 0) {
    await supabase.from("dre_lines").delete().in("period_id", periodIds);
  }

  const lineInserts: any[] = [];
  for (let lineIdx = 0; lineIdx < parsedLines.length; lineIdx++) {
    const line = parsedLines[lineIdx];
    for (const [pKey, pData] of periodMap.entries()) {
      const val = line.values.get(pData.colIndex);
      if (!line.isGroup && val === undefined) continue;
      lineInserts.push({
        period_id: pData.id, user_id: userId, group_label: line.groupLabel,
        line_label: line.label, value: val ?? 0,
        source_cell: `${dreTab}!${colToLetter(pData.colIndex)}${line.rowIndex + 1}`,
        source_tab: dreTab, order_index: lineIdx, is_group: line.isGroup, is_subtotal: line.isSubtotal,
        nucleo: null, section: null,
      });
    }
  }

  const BATCH_SIZE = 500;
  let totalInserted = 0;
  for (let i = 0; i < lineInserts.length; i += BATCH_SIZE) {
    const batch = lineInserts.slice(i, i + BATCH_SIZE);
    const { error: lineError } = await supabase.from("dre_lines").insert(batch);
    if (lineError) throw new Error(`Failed to insert lines batch: ${lineError.message}`);
    totalInserted += batch.length;
  }

  return {
    success: true, found: true, tab_name: dreTab, template: "DEFAULT",
    parser: "dre_matricial", dre_year: dreYear,
    periods_count: periodColumns.length, lines_count: totalInserted,
    periods: periodColumns.map(p => p.periodKey), warnings: 0,
  };
}

// ========== NEW MODEL: SAH (aba "DRE 2026") ==========

const SAH_MONTH_COLS: Array<{ month: string; prevCol: number; realCol: number }> = [
  { month: "01", prevCol: 4, realCol: 5 },   // E, F
  { month: "02", prevCol: 7, realCol: 8 },   // H, I
  { month: "03", prevCol: 10, realCol: 11 },  // K, L
  { month: "04", prevCol: 13, realCol: 14 },  // N, O
  { month: "05", prevCol: 16, realCol: 17 },  // Q, R
  { month: "06", prevCol: 19, realCol: 20 },  // T, U
  { month: "07", prevCol: 22, realCol: 23 },  // W, X
  { month: "08", prevCol: 25, realCol: 26 },  // Z, AA
  { month: "09", prevCol: 28, realCol: 29 },  // AC, AD
  { month: "10", prevCol: 31, realCol: 32 },  // AF, AG
  { month: "11", prevCol: 34, realCol: 35 },  // AI, AJ
  { month: "12", prevCol: 37, realCol: 38 },  // AL, AM
];

function matcherSAH(tabName: string, rows: string[][]): boolean {
  const norm = normalize(tabName);
  // Match "DRE YYYY" pattern (any year)
  if (!norm.match(/^dre\s+20\d{2}$/)) return false;
  
  // Check for dual-row header pattern: row 3 = months, row 4 = Previsto/Realizado
  if (rows.length < 5) return false;
  const row4 = rows[3] || [];
  let hasPrevisto = false;
  let hasRealizado = false;
  for (const cell of row4) {
    const n = normalize(String(cell ?? ""));
    if (n === "previsto") hasPrevisto = true;
    if (n === "realizado") hasRealizado = true;
  }
  return hasPrevisto && hasRealizado;
}

async function parseSAH(
  rows: string[][],
  dreTab: string,
  userId: string,
  connectionId: string,
  supabase: any,
): Promise<any> {
  const dreYear = extractYearFromTab(dreTab, rows) || 2026;
  console.log(`[dre-sync] SAH model: tab="${dreTab}", year=${dreYear}`);

  // Build period columns for both scenarios
  interface SAHPeriod { periodKey: string; periodLabel: string; scenario: string; colIndex: number; }
  const periods: SAHPeriod[] = [];

  // Annual totals: B=previsto, C=realizado
  periods.push({ periodKey: `${dreYear}-TOTAL`, periodLabel: `TOTAL ${dreYear} Previsto`, scenario: "previsto", colIndex: 1 });
  periods.push({ periodKey: `${dreYear}-TOTAL`, periodLabel: `TOTAL ${dreYear} Realizado`, scenario: "realizado", colIndex: 2 });

  // Monthly
  for (const mc of SAH_MONTH_COLS) {
    periods.push({ periodKey: `${dreYear}-${mc.month}`, periodLabel: `${mc.month}/${dreYear} Previsto`, scenario: "previsto", colIndex: mc.prevCol });
    periods.push({ periodKey: `${dreYear}-${mc.month}`, periodLabel: `${mc.month}/${dreYear} Realizado`, scenario: "realizado", colIndex: mc.realCol });
  }

  // Parse lines starting from row 5 (index 4)
  interface ParsedLine {
    label: string;
    rowIndex: number;
    isGroup: boolean;
    isSubtotal: boolean;
    groupLabel: string | null;
    values: Map<number, number>;
  }

  const parsedLines: ParsedLine[] = [];
  let currentGroup: string | null = null;

  for (let rowIdx = 4; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const label = String(row?.[0] ?? "").trim();
    if (!label) continue;
    
    // Stop at free-text notes (no values in any column)
    const normLabel = normalize(label);
    if (normLabel.startsWith("meta") && normLabel.length > 20) break; // free-text meta block

    const isGroup = isGroupLabel(label);
    const isSubtotal = isSubtotalLabel(label);
    if (isGroup) currentGroup = label;

    const allCols = periods.map(p => p.colIndex);
    const uniqueCols = [...new Set(allCols)];
    
    const values = new Map<number, number>();
    let hasAnyValue = false;
    for (const colIdx of uniqueCols) {
      const parsed = parseBRL(row?.[colIdx]);
      if (parsed !== null) { values.set(colIdx, parsed); hasAnyValue = true; }
    }

    if (!hasAnyValue && !isGroup) continue;

    parsedLines.push({ label, rowIndex: rowIdx, isGroup, isSubtotal, groupLabel: isGroup ? label : currentGroup, values });
  }

  if (parsedLines.length === 0) {
    return { success: false, found: true, message: "SAH: sem linhas válidas." };
  }

  console.log(`[dre-sync] SAH: parsed ${parsedLines.length} lines`);

  // Year-scoped cleanup — scoped by template_type SAH
  const { data: oldPeriods } = await supabase
    .from("dre_periods")
    .select("id, period_key")
    .eq("user_id", userId)
    .eq("sheet_id", connectionId)
    .eq("template_type", "SAH")
    .like("period_key", `${dreYear}%`);

  if (oldPeriods && oldPeriods.length > 0) {
    const oldIds = oldPeriods.map((p: any) => p.id);
    await supabase.from("dre_validation_issues").delete().in("period_id", oldIds);
    await supabase.from("dre_lines").delete().in("period_id", oldIds);
    await supabase.from("dre_periods").delete().in("id", oldIds);
  }

  // Insert periods (each scenario gets its own period record)
  const periodInserts = periods.map(p => ({
    user_id: userId,
    sheet_id: connectionId,
    period_key: p.periodKey,
    period_label: p.periodLabel,
    col_index: p.colIndex,
    validation_status: "ok",
    validation_notes: [],
    last_import_at: new Date().toISOString(),
    template_type: "SAH",
    scenario: p.scenario,
  }));

  const { data: insertedPeriods, error: periodError } = await supabase
    .from("dre_periods").insert(periodInserts).select("id, period_key, col_index, scenario");
  if (periodError) throw new Error(`SAH: Failed to insert periods: ${periodError.message}`);

  // Insert lines
  const lineInserts: any[] = [];
  for (let lineIdx = 0; lineIdx < parsedLines.length; lineIdx++) {
    const line = parsedLines[lineIdx];
    for (const period of (insertedPeriods || [])) {
      const val = line.values.get(period.col_index);
      if (!line.isGroup && val === undefined) continue;
      lineInserts.push({
        period_id: period.id, user_id: userId, group_label: line.groupLabel,
        line_label: line.label, value: val ?? 0,
        source_cell: `${dreTab}!${colToLetter(period.col_index)}${line.rowIndex + 1}`,
        source_tab: dreTab, order_index: lineIdx, is_group: line.isGroup, is_subtotal: line.isSubtotal,
        nucleo: null, section: period.scenario,
      });
    }
  }

  const BATCH_SIZE = 500;
  let totalInserted = 0;
  for (let i = 0; i < lineInserts.length; i += BATCH_SIZE) {
    const batch = lineInserts.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("dre_lines").insert(batch);
    if (error) throw new Error(`SAH: Failed to insert lines: ${error.message}`);
    totalInserted += batch.length;
  }

  return {
    success: true, found: true, tab_name: dreTab, template: "SAH",
    parser: "sah", dre_year: dreYear,
    periods_count: insertedPeriods?.length || 0, lines_count: totalInserted,
    periods: [...new Set(periods.map(p => p.periodKey))],
    scenarios: ["previsto", "realizado"],
    warnings: 0,
  };
}

// ========== NEW MODEL: StartSync (aba "2026 DRE") ==========

function matcherStartSync(tabName: string, rows: string[][]): boolean {
  const norm = normalize(tabName);
  // Match "2026 DRE" pattern
  if (!norm.match(/^20\d{2}\s+dre$/)) return false;
  // Verify B:M columns exist with month data
  if (rows.length < 3) return false;
  return true;
}

async function parseStartSync(
  rows: string[][],
  dreTab: string,
  userId: string,
  connectionId: string,
  supabase: any,
): Promise<any> {
  const dreYear = extractYearFromTab(dreTab, rows) || 2026;
  console.log(`[dre-sync] StartSync model: tab="${dreTab}", year=${dreYear}`);

  // Find header row with month columns
  let headerRowIdx = -1;
  let monthCols: Array<{ colIndex: number; periodKey: string; label: string }> = [];
  let totalColIdx = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    if (!row) continue;
    const candidates: Array<{ colIndex: number; periodKey: string; label: string }> = [];
    let foundTotal = -1;

    for (let c = 1; c < row.length; c++) {
      const val = String(row[c] ?? "").trim();
      if (!val) continue;
      const n = normalize(val);
      if (n === "total") { foundTotal = c; continue; }
      const parsed = parseMonthHeader(val);
      if (parsed && parsed.periodKey !== "TOTAL") {
        candidates.push({ colIndex: c, periodKey: parsed.periodKey, label: parsed.label });
      }
    }

    if (candidates.length >= 2) {
      headerRowIdx = r;
      monthCols = candidates;
      totalColIdx = foundTotal;

      // Scan adjacent row for additional month columns and TOTAL
      const nextRow = rows[r + 1];
      if (nextRow) {
        for (let c = 1; c < nextRow.length; c++) {
          const val = String(nextRow[c] ?? "").trim();
          if (!val) continue;
          const n = normalize(val);
          if (n === "total" && totalColIdx < 0) { totalColIdx = c; continue; }
          const parsed = parseMonthHeader(val);
          if (parsed && parsed.periodKey !== "TOTAL" && !monthCols.some(m => m.colIndex === c)) {
            monthCols.push({ colIndex: c, periodKey: parsed.periodKey, label: parsed.label });
          }
        }
        monthCols.sort((a, b) => a.colIndex - b.colIndex);
      }

      break;
    }
  }

  if (headerRowIdx === -1) {
    return { success: false, found: true, message: "StartSync: header de meses não encontrado." };
  }

  // Year-scope TOTAL
  const totalPeriodKey = `${dreYear}-TOTAL`;

  const periodColumns = [
    ...monthCols.map(m => ({ colIndex: m.colIndex, periodKey: m.periodKey, periodLabel: m.label })),
  ];
  if (totalColIdx >= 0) {
    periodColumns.push({ colIndex: totalColIdx, periodKey: totalPeriodKey, periodLabel: `TOTAL ${dreYear}` });
  }

  const allValueCols = periodColumns.map(p => p.colIndex);

  // Parse lines, stop at SALDO BANCÁRIO
  interface ParsedLine {
    label: string;
    rowIndex: number;
    isGroup: boolean;
    isSubtotal: boolean;
    groupLabel: string | null;
    values: Map<number, number>;
  }

  const parsedLines: ParsedLine[] = [];
  let currentGroup: string | null = null;

  for (let rowIdx = headerRowIdx + 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const label = String(row?.[0] ?? "").trim();
    if (!label) continue;

    const normLabel = normalize(label);

    // Stop at SALDO BANCÁRIO block
    if (normLabel.includes("saldo bancario") || normLabel.includes("saldo banco")) {
      console.log(`[dre-sync] StartSync: stopping at "${label}" (row ${rowIdx + 1})`);
      break;
    }

    const isGroup = isGroupLabel(label);
    const isSubtotal = isSubtotalLabel(label);
    if (isGroup) currentGroup = label;

    const values = new Map<number, number>();
    let hasAnyValue = false;
    for (const colIdx of allValueCols) {
      const parsed = parseBRL(row?.[colIdx]);
      if (parsed !== null) { values.set(colIdx, parsed); hasAnyValue = true; }
    }

    if (!hasAnyValue && !isGroup) continue;
    parsedLines.push({ label, rowIndex: rowIdx, isGroup, isSubtotal, groupLabel: isGroup ? label : currentGroup, values });
  }

  // Auto-calculate TOTAL for lines where TOTAL cell is empty but month values exist
  if (totalColIdx >= 0) {
    const monthColIndices = monthCols.map(m => m.colIndex);
    for (const line of parsedLines) {
      if (!line.values.has(totalColIdx)) {
        let sum = 0;
        let hasMonthValue = false;
        for (const mci of monthColIndices) {
          const v = line.values.get(mci);
          if (v !== undefined) { sum += v; hasMonthValue = true; }
        }
        if (hasMonthValue) {
          line.values.set(totalColIdx, Math.round(sum * 100) / 100);
        }
      }
    }
  }

  if (parsedLines.length === 0) {
    return { success: false, found: true, message: "StartSync: sem linhas válidas." };
  }

  console.log(`[dre-sync] StartSync: parsed ${parsedLines.length} lines for ${periodColumns.length} periods`);

  // Year-scoped cleanup — scoped by template_type STARTSYNC
  const { data: oldPeriods } = await supabase
    .from("dre_periods")
    .select("id, period_key")
    .eq("user_id", userId)
    .eq("sheet_id", connectionId)
    .eq("template_type", "STARTSYNC")
    .like("period_key", `${dreYear}%`);

  if (oldPeriods && oldPeriods.length > 0) {
    const oldIds = oldPeriods.map((p: any) => p.id);
    await supabase.from("dre_validation_issues").delete().in("period_id", oldIds);
    await supabase.from("dre_lines").delete().in("period_id", oldIds);
    await supabase.from("dre_periods").delete().in("id", oldIds);
  }

  // Insert periods
  const periodInserts = periodColumns.map(pc => ({
    user_id: userId,
    sheet_id: connectionId,
    period_key: pc.periodKey,
    period_label: pc.periodLabel,
    col_index: pc.colIndex,
    validation_status: "ok",
    validation_notes: [],
    last_import_at: new Date().toISOString(),
    template_type: "STARTSYNC",
    scenario: null,
  }));

  const { data: insertedPeriods, error: periodError } = await supabase
    .from("dre_periods").insert(periodInserts).select("id, period_key, col_index");
  if (periodError) throw new Error(`StartSync: Failed to insert periods: ${periodError.message}`);

  const periodMap = new Map<string, { id: string; colIndex: number }>();
  for (const p of (insertedPeriods || [])) {
    periodMap.set(p.period_key, { id: p.id, colIndex: p.col_index });
  }

  // Insert lines
  const lineInserts: any[] = [];
  for (let lineIdx = 0; lineIdx < parsedLines.length; lineIdx++) {
    const line = parsedLines[lineIdx];
    for (const [pKey, pData] of periodMap.entries()) {
      const val = line.values.get(pData.colIndex);
      if (!line.isGroup && val === undefined) continue;
      lineInserts.push({
        period_id: pData.id, user_id: userId, group_label: line.groupLabel,
        line_label: line.label, value: val ?? 0,
        source_cell: `${dreTab}!${colToLetter(pData.colIndex)}${line.rowIndex + 1}`,
        source_tab: dreTab, order_index: lineIdx, is_group: line.isGroup, is_subtotal: line.isSubtotal,
        nucleo: null, section: null,
      });
    }
  }

  const BATCH_SIZE = 500;
  let totalInserted = 0;
  for (let i = 0; i < lineInserts.length; i += BATCH_SIZE) {
    const batch = lineInserts.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("dre_lines").insert(batch);
    if (error) throw new Error(`StartSync: Failed to insert lines: ${error.message}`);
    totalInserted += batch.length;
  }

  return {
    success: true, found: true, tab_name: dreTab, template: "STARTSYNC",
    parser: "startsync", dre_year: dreYear,
    periods_count: periodColumns.length, lines_count: totalInserted,
    periods: periodColumns.map(p => p.periodKey),
    warnings: 0,
  };
}

// ========== NEW MODEL: GR (aba "DRE-Caixa") ==========

function matcherGR(tabName: string, rows: string[][]): boolean {
  const norm = normalize(tabName);
  return norm === "dre-caixa" || norm === "dre caixa";
}

async function parseGR(
  rows: string[][],
  dreTab: string,
  userId: string,
  connectionId: string,
  supabase: any,
): Promise<any> {
  const dreYear = extractYearFromTab(dreTab, rows) || 2026;
  console.log(`[dre-sync] GR model: tab="${dreTab}", year=${dreYear}`);

  // Find header row with month columns
  let headerRowIdx = -1;
  let monthCols: Array<{ colIndex: number; periodKey: string; label: string }> = [];
  let totalColIdx = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    if (!row) continue;
    const candidates: Array<{ colIndex: number; periodKey: string; label: string }> = [];
    let foundTotal = -1;

    for (let c = 1; c < row.length; c++) {
      const val = String(row[c] ?? "").trim();
      if (!val) continue;
      const n = normalize(val);
      if (n === "total") { foundTotal = c; continue; }
      const parsed = parseMonthHeader(val);
      if (parsed && parsed.periodKey !== "TOTAL") {
        candidates.push({ colIndex: c, periodKey: parsed.periodKey, label: parsed.label });
      }
    }

    if (candidates.length >= 6) {
      headerRowIdx = r;
      monthCols = candidates;
      totalColIdx = foundTotal;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return { success: false, found: true, message: "GR: header de meses não encontrado." };
  }

  const totalPeriodKey = `${dreYear}-TOTAL`;
  const periodColumns = [
    ...monthCols.map(m => ({ colIndex: m.colIndex, periodKey: m.periodKey, periodLabel: m.label })),
  ];
  if (totalColIdx >= 0) {
    periodColumns.push({ colIndex: totalColIdx, periodKey: totalPeriodKey, periodLabel: `TOTAL ${dreYear}` });
  }

  const allValueCols = periodColumns.map(p => p.colIndex);

  // Track duplicate labels
  const labelCount = new Map<string, number>();
  const warnings: string[] = [];

  interface ParsedLine {
    label: string;
    displayLabel: string;
    lineKey: string;
    rowIndex: number;
    isGroup: boolean;
    isSubtotal: boolean;
    groupLabel: string | null;
    values: Map<number, number>;
  }

  const parsedLines: ParsedLine[] = [];
  let currentGroup: string | null = null;

  for (let rowIdx = headerRowIdx + 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const label = String(row?.[0] ?? "").trim();
    if (!label) continue;

    const normLabel = normalize(label);

    // Skip unlabeled percentage rows (no text label, or just % format)
    if (/^[\d\.,\-%]+$/.test(label)) continue;

    const isGroup = isGroupLabel(label);
    const isSubtotal = isSubtotalLabel(label);
    if (isGroup) currentGroup = label;

    // Handle duplicate labels
    const slug = slugify(label);
    const count = (labelCount.get(slug) || 0) + 1;
    labelCount.set(slug, count);

    let displayLabel = label;
    const lineKey = `${slug}__r${rowIdx}`;

    // Special handling for duplicate "RESULTADO MÊS"
    if (normLabel.includes("resultado mes") || normLabel.includes("resultado do mes")) {
      if (count === 1) {
        displayLabel = `${label} (pré distribuição)`;
      } else if (count >= 2) {
        displayLabel = `${label} (pós distribuição)`;
      }
    }

    const values = new Map<number, number>();
    let hasAnyValue = false;
    let hasNAWarning = false;
    for (const colIdx of allValueCols) {
      const cellVal = row?.[colIdx];
      const cellStr = String(cellVal ?? "").trim();
      
      // Handle #N/A gracefully
      if (cellStr.startsWith("#")) {
        hasNAWarning = true;
        continue;
      }
      
      const parsed = parseBRL(cellVal);
      if (parsed !== null) { values.set(colIdx, parsed); hasAnyValue = true; }
    }

    if (hasNAWarning) {
      warnings.push(`Row ${rowIdx + 1} "${label}": contém #N/A em algumas colunas`);
    }

    if (!hasAnyValue && !isGroup) continue;
    parsedLines.push({ label, displayLabel, lineKey, rowIndex: rowIdx, isGroup, isSubtotal, groupLabel: isGroup ? label : currentGroup, values });
  }

  // Auto-calculate TOTAL for lines where TOTAL cell is empty but month values exist
  if (totalColIdx >= 0) {
    const monthColIndices = monthCols.map(m => m.colIndex);
    for (const line of parsedLines) {
      if (!line.values.has(totalColIdx)) {
        let sum = 0;
        let hasMonthValue = false;
        for (const mci of monthColIndices) {
          const v = line.values.get(mci);
          if (v !== undefined) { sum += v; hasMonthValue = true; }
        }
        if (hasMonthValue) {
          line.values.set(totalColIdx, Math.round(sum * 100) / 100);
        }
      }
    }
  }

  if (parsedLines.length === 0) {
    return { success: false, found: true, message: "GR: sem linhas válidas." };
  }

  console.log(`[dre-sync] GR: parsed ${parsedLines.length} lines, ${warnings.length} warnings`);

  // Year-scoped cleanup — scoped by template_type GR
  const { data: oldPeriods } = await supabase
    .from("dre_periods")
    .select("id, period_key")
    .eq("user_id", userId)
    .eq("sheet_id", connectionId)
    .eq("template_type", "GR")
    .like("period_key", `${dreYear}%`);

  if (oldPeriods && oldPeriods.length > 0) {
    const oldIds = oldPeriods.map((p: any) => p.id);
    await supabase.from("dre_validation_issues").delete().in("period_id", oldIds);
    await supabase.from("dre_lines").delete().in("period_id", oldIds);
    await supabase.from("dre_periods").delete().in("id", oldIds);
  }

  // Insert periods
  const periodInserts = periodColumns.map(pc => ({
    user_id: userId,
    sheet_id: connectionId,
    period_key: pc.periodKey,
    period_label: pc.periodLabel,
    col_index: pc.colIndex,
    validation_status: "ok",
    validation_notes: [],
    last_import_at: new Date().toISOString(),
    template_type: "GR",
    scenario: null,
  }));

  const { data: insertedPeriods, error: periodError } = await supabase
    .from("dre_periods").insert(periodInserts).select("id, period_key, col_index");
  if (periodError) throw new Error(`GR: Failed to insert periods: ${periodError.message}`);

  const periodMap = new Map<string, { id: string; colIndex: number }>();
  for (const p of (insertedPeriods || [])) {
    periodMap.set(p.period_key, { id: p.id, colIndex: p.col_index });
  }

  // Insert lines (use displayLabel for renamed duplicates)
  const lineInserts: any[] = [];
  for (let lineIdx = 0; lineIdx < parsedLines.length; lineIdx++) {
    const line = parsedLines[lineIdx];
    for (const [pKey, pData] of periodMap.entries()) {
      const val = line.values.get(pData.colIndex);
      if (!line.isGroup && val === undefined) continue;
      lineInserts.push({
        period_id: pData.id, user_id: userId, group_label: line.groupLabel,
        line_label: line.displayLabel, value: val ?? 0,
        source_cell: `${dreTab}!${colToLetter(pData.colIndex)}${line.rowIndex + 1}`,
        source_tab: dreTab, order_index: lineIdx, is_group: line.isGroup, is_subtotal: line.isSubtotal,
        nucleo: null, section: null,
      });
    }
  }

  const BATCH_SIZE = 500;
  let totalInserted = 0;
  for (let i = 0; i < lineInserts.length; i += BATCH_SIZE) {
    const batch = lineInserts.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("dre_lines").insert(batch);
    if (error) throw new Error(`GR: Failed to insert lines: ${error.message}`);
    totalInserted += batch.length;
  }

  return {
    success: true, found: true, tab_name: dreTab, template: "GR",
    parser: "gr_caixa", dre_year: dreYear,
    periods_count: periodColumns.length, lines_count: totalInserted,
    periods: periodColumns.map(p => p.periodKey),
    warnings: warnings.length,
    warning_details: warnings.slice(0, 20),
  };
}

// ========== MODEL REGISTRY ==========

interface DreModel {
  id: string;
  matcher: (tabName: string, rows: string[][]) => boolean;
  parse: (rows: string[][], tabName: string, userId: string, connectionId: string, supabase: any) => Promise<any>;
}

const DRE_MODELS: DreModel[] = [
  { id: "SAH", matcher: matcherSAH, parse: parseSAH },
  { id: "STARTSYNC", matcher: matcherStartSync, parse: parseStartSync },
  { id: "GR", matcher: matcherGR, parse: parseGR },
];

// ========== LCF NUCLEO PARSER (EXISTING - UNTOUCHED) ==========

interface LcfSection {
  key: string;
  label: string;
}

const LCF_SECTIONS: LcfSection[] = [
  { key: "RECEITA_BRUTA", label: "receita bruta" },
  { key: "DESPESAS_NUCLEO", label: "despesas totais" },
  { key: "DESPESAS_ESCRITORIO", label: "despesas totais escritorio" },
  { key: "RESULTADO", label: "resultado" },
  { key: "SOBRA", label: "sobra" },
  { key: "DISTRIBUICAO", label: "lucro distribuido" },
];

function detectSection(label: string): string | null {
  const n = normalize(label);
  if (n.includes("despesas totais") && n.includes("escritorio")) return "DESPESAS_ESCRITORIO";
  if (n.includes("despesas totais") && n.includes("nucleo")) return "DESPESAS_NUCLEO";
  if (n.includes("despesas totais")) return "DESPESAS_NUCLEO";
  if (n.includes("receita bruta")) return "RECEITA_BRUTA";
  if (n.includes("sobra de cada nucleo") || n.includes("sobra")) return "SOBRA";
  if (n.includes("lucro distribuido") || n.includes("distribuicao")) return "DISTRIBUICAO";
  if (n.includes("resultado") && n.includes("antes") && n.includes("despesas") && n.includes("escritorio")) return "RESULTADO_PRE_ESCRITORIO";
  if (n.includes("resultado") && n.includes("participac")) return "RESULTADO_FINAL";
  if (n.includes("resultado")) return "RESULTADO";
  return null;
}

interface LcfParsedLine {
  label: string;
  section: string | null;
  nucleo: string | null;
  value: number;
  order: number;
  isGroup: boolean;
  isSubtotal: boolean;
  groupLabel: string | null;
  sourceCell: string;
}

interface LcfParseResult {
  periodKey: string | null;
  lines: LcfParsedLine[];
  nucleos: string[];
}

function parseDreLcfNucleo(rows: string[][], sheetName: string): LcfParseResult {
  let periodKey = extractPeriodFromTabName(sheetName);
  if (!periodKey) {
    periodKey = extractPeriodFromContent(rows);
  }

  const nucleoColumns: Array<{ name: string; colIndex: number }> = [];
  let headerRowIdx = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    for (let c = 1; c < (row?.length || 0); c++) {
      const cell = String(row[c] || "").trim();
      const n = normalize(cell);
      if (n.includes("ambiental") || n === "ambiental") {
        nucleoColumns.push({ name: "AMBIENTAL", colIndex: c });
        headerRowIdx = r;
      }
      if (n.includes("penal") || n === "penal") {
        nucleoColumns.push({ name: "PENAL", colIndex: c });
        headerRowIdx = r;
      }
    }
    if (nucleoColumns.length >= 2) break;
  }

  const nucleos = nucleoColumns.map(nc => nc.name);
  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 1;

  const lines: LcfParsedLine[] = [];
  let currentSection: string | null = null;
  let currentGroup: string | null = null;
  let order = 0;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    const label = String(row?.[0] || "").trim();
    if (!label) continue;

    const isGroup = isGroupLabel(label);
    const sectionDetected = detectSection(label);
    const isSubtotal = isSubtotalLabel(label) || sectionDetected !== null;

    if (sectionDetected) currentSection = sectionDetected;
    if (isGroup) currentGroup = label;

    if (nucleoColumns.length >= 2) {
      for (const nc of nucleoColumns) {
        const cellVal = row?.[nc.colIndex];
        const parsed = parseBRL(cellVal);
        if (parsed !== null || isGroup || isSubtotal) {
          lines.push({
            label, section: currentSection, nucleo: nc.name,
            value: parsed ?? 0, order, isGroup, isSubtotal,
            groupLabel: isGroup ? label : currentGroup,
            sourceCell: `${sheetName}!${colToLetter(nc.colIndex)}${r + 1}`,
          });
        }
      }

      const values = nucleoColumns.map(nc => parseBRL(row?.[nc.colIndex]));
      const hasAny = values.some(v => v !== null);
      if (hasAny || isGroup || isSubtotal) {
        const consolidated = values.reduce((sum, v) => (sum ?? 0) + (v ?? 0), 0) ?? 0;
        lines.push({
          label, section: currentSection, nucleo: null,
          value: consolidated, order, isGroup, isSubtotal,
          groupLabel: isGroup ? label : currentGroup,
          sourceCell: `${sheetName}!A${r + 1}`,
        });
      }
    } else {
      const val = parseBRL(row?.[1]);
      if (val !== null || isGroup || isSubtotal) {
        lines.push({
          label, section: currentSection, nucleo: null,
          value: val ?? 0, order, isGroup, isSubtotal,
          groupLabel: isGroup ? label : currentGroup,
          sourceCell: `${sheetName}!B${r + 1}`,
        });
      }
    }

    order++;
  }

  return { periodKey, lines, nucleos };
}

// ========== LCF VALIDATION ==========

interface ValidationIssue {
  ruleCode: string;
  expectedCents: number;
  actualCents: number;
  diffCents: number;
  details: Record<string, unknown>;
}

function validateDreLcf(lines: LcfParsedLine[], _periodKey: string | null): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const consolidated = lines.filter(l => l.nucleo === null);

  const findBySection = (section: string) =>
    consolidated.find(l => l.section === section && l.isSubtotal);

  const receitaBruta = findBySection("RECEITA_BRUTA");
  const despesasNucleo = findBySection("DESPESAS_NUCLEO");
  const despesasEscritorio = findBySection("DESPESAS_ESCRITORIO");
  const resultado = findBySection("RESULTADO_FINAL") || findBySection("RESULTADO");

  if (receitaBruta && despesasNucleo && resultado) {
    const expected = receitaBruta.value + despesasNucleo.value + (despesasEscritorio?.value ?? 0);
    const diff = Math.abs(resultado.value - expected);
    if (diff > 0.01) {
      issues.push({
        ruleCode: "RESULTADO_VS_RECEITA_DESPESA",
        expectedCents: Math.round(expected * 100),
        actualCents: Math.round(resultado.value * 100),
        diffCents: Math.round(diff * 100),
        details: { receitaBruta: receitaBruta.value, despesasNucleo: despesasNucleo.value, resultado: resultado.value },
      });
    }
  }

  for (const nucleoName of ["AMBIENTAL", "PENAL"]) {
    const nLines = lines.filter(l => l.nucleo === nucleoName);
    const nReceita = nLines.find(l => l.section === "RECEITA_BRUTA" && l.isSubtotal);
    const nDespesa = nLines.find(l => l.section === "DESPESAS_NUCLEO" && l.isSubtotal);
    const nResultado = nLines.find(l => l.section === "RESULTADO_FINAL" && l.isSubtotal) || nLines.find(l => l.section === "RESULTADO" && l.isSubtotal);

    if (nReceita && nDespesa && nResultado) {
      const expected = nReceita.value + nDespesa.value;
      const diff = Math.abs(nResultado.value - expected);
      if (diff > 0.01) {
        issues.push({
          ruleCode: `RESULTADO_${nucleoName}`,
          expectedCents: Math.round(expected * 100),
          actualCents: Math.round(nResultado.value * 100),
          diffCents: Math.round(diff * 100),
          details: { nucleo: nucleoName, receita: nReceita.value, despesa: nDespesa.value, resultado: nResultado.value },
        });
      }
    }
  }

  return issues;
}

// ========== DEFAULT PARSER (existing logic - UNTOUCHED) ==========

async function parseDefaultDre(
  rows: string[][],
  dreTab: string,
  userId: string,
  connectionId: string,
  supabase: any,
) {
  let headerRowIndex = -1;
  let monthCols: Array<{ colIndex: number; periodKey: string; label: string }> = [];
  let totalColIndex = -1;

  for (let rowIdx = 0; rowIdx < Math.min(rows.length, 10); rowIdx++) {
    const row = rows[rowIdx];
    const candidates: Array<{ colIndex: number; periodKey: string; label: string }> = [];
    let foundTotal = -1;

    for (let colIdx = 1; colIdx < row.length; colIdx++) {
      const val = row[colIdx];
      if (!val || !String(val).trim()) continue;
      if (normalize(String(val)) === "total") { foundTotal = colIdx; continue; }
      const parsed = parseMonthHeader(String(val));
      if (parsed && parsed.periodKey !== "TOTAL") {
        candidates.push({ colIndex: colIdx, periodKey: parsed.periodKey, label: parsed.label });
      }
    }

    if (candidates.length >= 2) {
      headerRowIndex = rowIdx;
      monthCols = candidates;
      totalColIndex = foundTotal;

      // Scan adjacent row for additional month columns and TOTAL
      const nextRow = rows[rowIdx + 1];
      if (nextRow) {
        for (let colIdx = 1; colIdx < nextRow.length; colIdx++) {
          const val = nextRow[colIdx];
          if (!val || !String(val).trim()) continue;
          const n = normalize(String(val));
          if (n === "total" && totalColIndex < 0) { totalColIndex = colIdx; continue; }
          const parsed = parseMonthHeader(String(val));
          if (parsed && parsed.periodKey !== "TOTAL" && !monthCols.some(c => c.colIndex === colIdx)) {
            monthCols.push({ colIndex: colIdx, periodKey: parsed.periodKey, label: parsed.label });
          }
        }
        monthCols.sort((a, b) => a.colIndex - b.colIndex);
      }

      break;
    }
  }

  if (headerRowIndex === -1) {
    return { success: false, found: true, message: "Não foi possível detectar o header de meses na aba DRE." };
  }

  interface ParsedLine {
    label: string;
    rowIndex: number;
    isGroup: boolean;
    isSubtotal: boolean;
    groupLabel: string | null;
    values: Map<number, number>;
  }

  const parsedLines: ParsedLine[] = [];
  let currentGroup: string | null = null;
  const allValueCols = [...monthCols.map(m => m.colIndex)];
  if (totalColIndex >= 0) allValueCols.push(totalColIndex);

  for (let rowIdx = headerRowIndex + 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const label = row?.[0]?.trim() || "";
    if (!label) continue;
    if (/^%/.test(label)) continue;

    const isGroup = isGroupLabel(label);
    const isSubtotal = isSubtotalLabel(label);
    if (isGroup) currentGroup = label;

    const values = new Map<number, number>();
    let hasAnyValue = false;
    for (const colIdx of allValueCols) {
      const parsed = parseBRL(row?.[colIdx]);
      if (parsed !== null) { values.set(colIdx, parsed); hasAnyValue = true; }
    }
    if (!hasAnyValue && !isGroup) continue;

    parsedLines.push({ label, rowIndex: rowIdx, isGroup, isSubtotal, groupLabel: isGroup ? label : currentGroup, values });
  }

  const periodColumns = [
    ...monthCols.map(m => ({ colIndex: m.colIndex, periodKey: m.periodKey, periodLabel: m.label })),
  ];
  if (totalColIndex >= 0) {
    const defYear = extractYearFromTab(dreTab, rows);
    const defTotalKey = defYear ? `${defYear}-TOTAL` : "TOTAL";
    periodColumns.push({ colIndex: totalColIndex, periodKey: defTotalKey, periodLabel: `TOTAL ${defYear || ""}`.trim() });
  }

  // Auto-calculate TOTAL for lines where TOTAL cell is empty but month values exist
  if (totalColIndex >= 0) {
    const monthColIndices = monthCols.map(m => m.colIndex);
    for (const line of parsedLines) {
      if (!line.values.has(totalColIndex)) {
        let sum = 0;
        let hasMonthValue = false;
        for (const mci of monthColIndices) {
          const v = line.values.get(mci);
          if (v !== undefined) { sum += v; hasMonthValue = true; }
        }
        if (hasMonthValue) {
          line.values.set(totalColIndex, Math.round(sum * 100) / 100);
        }
      }
    }
  }

  // Year-scoped cleanup for DEFAULT template
  const defCleanupYear = extractYearFromTab(dreTab, rows);
  const { data: oldPeriods } = await supabase
    .from("dre_periods")
    .select("id, period_key")
    .eq("user_id", userId)
    .eq("sheet_id", connectionId)
    .eq("template_type", "DEFAULT");

  if (oldPeriods && oldPeriods.length > 0) {
    const yearStr = defCleanupYear ? String(defCleanupYear) : null;
    const periodsToDelete = yearStr
      ? oldPeriods.filter((p: any) => p.period_key.startsWith(yearStr) || p.period_key === "TOTAL")
      : oldPeriods;
    if (periodsToDelete.length > 0) {
      const oldIds = periodsToDelete.map((p: any) => p.id);
      await supabase.from("dre_validation_issues").delete().in("period_id", oldIds);
      await supabase.from("dre_lines").delete().in("period_id", oldIds);
      await supabase.from("dre_periods").delete().in("id", oldIds);
    }
  }

  const periodInserts = periodColumns.map(pc => ({
    user_id: userId,
    sheet_id: connectionId,
    period_key: pc.periodKey,
    period_label: pc.periodLabel,
    col_index: pc.colIndex,
    validation_status: "ok",
    validation_notes: [],
    last_import_at: new Date().toISOString(),
    template_type: "DEFAULT",
    scenario: null,
  }));

  const { data: insertedPeriods, error: periodError } = await supabase
    .from("dre_periods").insert(periodInserts).select("id, period_key, col_index");
  if (periodError) throw new Error(`Failed to insert periods: ${periodError.message}`);

  const periodMap = new Map<string, { id: string; colIndex: number }>();
  for (const p of insertedPeriods || []) {
    periodMap.set(p.period_key, { id: p.id, colIndex: p.col_index });
  }

  const lineInserts: any[] = [];
  for (let lineIdx = 0; lineIdx < parsedLines.length; lineIdx++) {
    const line = parsedLines[lineIdx];
    for (const [pKey, pData] of periodMap.entries()) {
      const val = line.values.get(pData.colIndex);
      if (!line.isGroup && val === undefined) continue;
      lineInserts.push({
        period_id: pData.id, user_id: userId, group_label: line.groupLabel,
        line_label: line.label, value: val ?? 0,
        source_cell: `${dreTab}!${colToLetter(pData.colIndex)}${line.rowIndex + 1}`,
        source_tab: dreTab, order_index: lineIdx, is_group: line.isGroup, is_subtotal: line.isSubtotal,
        nucleo: null, section: null,
      });
    }
  }

  const BATCH_SIZE = 500;
  let totalInserted = 0;
  for (let i = 0; i < lineInserts.length; i += BATCH_SIZE) {
    const batch = lineInserts.slice(i, i + BATCH_SIZE);
    const { error: lineError } = await supabase.from("dre_lines").insert(batch);
    if (lineError) throw new Error(`Failed to insert lines batch: ${lineError.message}`);
    totalInserted += batch.length;
  }

  return {
    success: totalInserted > 0, found: true, tab_name: dreTab,
    template: "DEFAULT", periods_count: periodColumns.length,
    lines_count: totalInserted, periods: periodColumns.map(p => p.periodKey),
  };
}

// ========== IMPORT LCF TAB (EXISTING - UNTOUCHED) ==========

async function importLcfTab(
  rows: string[][],
  tabName: string,
  userId: string,
  connectionId: string,
  supabase: any,
): Promise<{ periodKey: string | null; linesCount: number; status: string; warnings: number }> {
  const result = parseDreLcfNucleo(rows, tabName);
  const status = result.periodKey ? "ok" : "NEEDS_REVIEW";
  const periodKey = result.periodKey || `REVIEW_${tabName.replace(/\s+/g, "_")}`;

  const { data: oldPeriods } = await supabase
    .from("dre_periods")
    .select("id")
    .eq("user_id", userId)
    .eq("sheet_id", connectionId)
    .eq("period_key", periodKey)
    .eq("template_type", "LCF_NUCLEO");

  if (oldPeriods && oldPeriods.length > 0) {
    const oldIds = oldPeriods.map((p: any) => p.id);
    await supabase.from("dre_validation_issues").delete().in("period_id", oldIds);
    await supabase.from("dre_lines").delete().in("period_id", oldIds);
    await supabase.from("dre_periods").delete().in("id", oldIds);
  }

  const { data: insertedPeriod, error: pErr } = await supabase
    .from("dre_periods")
    .insert({
      user_id: userId,
      sheet_id: connectionId,
      period_key: periodKey,
      period_label: tabName.replace(/^DRE\s*/i, "").trim() || periodKey,
      col_index: null,
      validation_status: status,
      validation_notes: [],
      last_import_at: new Date().toISOString(),
      template_type: "LCF_NUCLEO",
    })
    .select("id")
    .single();
  if (pErr) throw new Error(`Failed to insert LCF period: ${pErr.message}`);

  const periodId = insertedPeriod.id;

  const lineInserts = result.lines.map(l => ({
    period_id: periodId,
    user_id: userId,
    group_label: l.groupLabel,
    line_label: l.label,
    value: l.value,
    source_cell: l.sourceCell,
    source_tab: tabName,
    order_index: l.order,
    is_group: l.isGroup,
    is_subtotal: l.isSubtotal,
    nucleo: l.nucleo,
    section: l.section,
  }));

  const BATCH_SIZE = 500;
  let totalInserted = 0;
  for (let i = 0; i < lineInserts.length; i += BATCH_SIZE) {
    const batch = lineInserts.slice(i, i + BATCH_SIZE);
    const { error: lErr } = await supabase.from("dre_lines").insert(batch);
    if (lErr) throw new Error(`Failed to insert LCF lines: ${lErr.message}`);
    totalInserted += batch.length;
  }

  const issues = validateDreLcf(result.lines, result.periodKey);
  if (issues.length > 0) {
    await supabase.from("dre_periods").update({
      validation_status: "warning",
      validation_notes: issues.map(i => `${i.ruleCode}: esperado=${i.expectedCents}, real=${i.actualCents}`),
    }).eq("id", periodId);

    const issueInserts = issues.map(i => ({
      period_id: periodId,
      user_id: userId,
      rule_code: i.ruleCode,
      expected_cents: i.expectedCents,
      actual_cents: i.actualCents,
      diff_cents: i.diffCents,
      details_json: i.details,
    }));
    await supabase.from("dre_validation_issues").insert(issueInserts);
  }

  return { periodKey: result.periodKey, linesCount: totalInserted, status, warnings: issues.length };
}

// ========== READ TAB DATA ==========

async function readTabData(
  tabName: string,
  accessToken: string,
  spreadsheetId: string,
  xlsxWorkbook: any | null,
): Promise<string[][]> {
  if (xlsxWorkbook) {
    return xlsxSheetToRows(xlsxWorkbook, tabName);
  }
  const range = encodeURIComponent(`'${tabName}'!A1:AZ1000`);
  const dataRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!dataRes.ok) throw new Error(`Failed to read tab ${tabName}: ${dataRes.status}`);
  const sheetData = await dataRes.json();
  return sheetData.values || [];
}

// ========== MAIN ==========

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const { connection_id } = body;
    if (!connection_id) throw new Error("connection_id is required");

    // 1. Get connection
    const { data: connection, error: connError } = await supabase
      .from("google_sheet_connections")
      .select("*")
      .eq("id", connection_id)
      .eq("user_id", userId)
      .single();
    if (connError || !connection) throw new Error("Connection not found");

    // 2. Refresh token
    let accessToken = connection.access_token;
    const tokenExpired = !connection.token_expires_at || new Date(connection.token_expires_at) < new Date();
    if (tokenExpired || !accessToken) {
      const refreshed = await refreshAccessToken(connection.refresh_token);
      accessToken = refreshed.access_token;
      await supabase.from("google_sheet_connections").update({
        access_token: refreshed.access_token,
        token_expires_at: refreshed.expires_at,
      }).eq("id", connection_id);
    }

    // 3. Get sheet titles
    const fileInfo = await getFileMimeType(accessToken!, connection.spreadsheet_id);
    const isXlsx = fileInfo.mimeType === XLSX_MIME;
    let xlsxWorkbook: any = null;
    if (isXlsx) xlsxWorkbook = await downloadXlsxWorkbook(accessToken!, connection.spreadsheet_id);

    let sheetTitles: string[];
    if (xlsxWorkbook) {
      sheetTitles = xlsxWorkbook.SheetNames;
    } else {
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}?fields=sheets.properties.title`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!metaRes.ok) throw new Error("Failed to fetch spreadsheet metadata");
      const meta = await metaRes.json();
      sheetTitles = meta.sheets.map((s: { properties: { title: string } }) => s.properties.title);
    }

    // 4. Find ALL candidate DRE tabs
    const candidateTabs = listCandidateDreSheets(sheetTitles);
    if (candidateTabs.length === 0) {
      return new Response(JSON.stringify({
        success: false, found: false,
        message: "Aba DRE não encontrada na planilha. Crie uma aba chamada 'DRE' com os dados do demonstrativo.",
        available_tabs: sheetTitles,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[dre-sync] Found ${candidateTabs.length} DRE candidate tabs: ${candidateTabs.join(", ")}`);

    // 5. Read all tabs and score them
    const tabData: Array<{ tab: string; rows: string[][]; score: number }> = [];
    for (const tab of candidateTabs) {
      const rows = await readTabData(tab, accessToken!, connection.spreadsheet_id, xlsxWorkbook);
      if (rows.length < 2) continue;
      const score = scoreDreTab(tab, rows);
      tabData.push({ tab, rows, score });
    }

    // Sort by score descending (2026 first)
    tabData.sort((a, b) => b.score - a.score);

    console.log(`[dre-sync] Tab scores: ${tabData.map(t => `${t.tab}=${t.score}`).join(", ")}`);

    // 5.5 Global cleanup: delete ALL existing DRE data for this connection
    // This prevents duplicate key errors when template_type changes between syncs
    const { data: allOldPeriods } = await supabase
      .from("dre_periods")
      .select("id")
      .eq("user_id", userId)
      .eq("sheet_id", connection_id);

    if (allOldPeriods && allOldPeriods.length > 0) {
      const allOldIds = allOldPeriods.map((p: any) => p.id);
      await supabase.from("dre_validation_issues").delete().in("period_id", allOldIds);
      await supabase.from("dre_lines").delete().in("period_id", allOldIds);
      await supabase.from("dre_periods").delete().in("id", allOldIds);
      console.log(`[dre-sync] Global cleanup: removed ${allOldIds.length} old periods`);
    }

    // 6. Try new models first (SAH, StartSync, GR)
    const allResults: any[] = [];
    const processedTabs = new Set<string>();

    for (const entry of tabData) {
      if (processedTabs.has(entry.tab)) continue;

      for (const model of DRE_MODELS) {
        if (model.matcher(entry.tab, entry.rows)) {
          console.log(`[dre-sync] Model ${model.id} matched tab "${entry.tab}"`);
          try {
            const result = await model.parse(entry.rows, entry.tab, userId, connection_id, supabase);
            if (result.success) {
              allResults.push(result);
              processedTabs.add(entry.tab);
            }
          } catch (modelErr) {
            console.error(`[dre-sync] Model ${model.id} failed for tab "${entry.tab}":`, modelErr);
            allResults.push({
              success: false, found: true, tab_name: entry.tab, template: model.id,
              error: modelErr instanceof Error ? modelErr.message : "Unknown error",
            });
          }
          break;
        }
      }
    }

    // 7. Process remaining tabs with existing parsers (LCF, DEFAULT, Matrix)
    const remainingTabs = tabData.filter(t => !processedTabs.has(t.tab));

    if (remainingTabs.length > 0) {
      // Classify remaining tabs
      const lcfTabs: typeof tabData = [];
      const defaultTabs: Array<typeof tabData[0] & { matrixDetect: MatrixDetectResult | null }> = [];

      for (const entry of remainingTabs) {
        const template = detectDreTemplate(entry.rows);
        if (template === "LCF_NUCLEO") {
          lcfTabs.push(entry);
        } else {
          const matrixDetect = detectDreMatrix(entry.rows);
          defaultTabs.push({ ...entry, matrixDetect });
        }
      }

      // Process LCF tabs
      if (lcfTabs.length > 0) {
        // Clean old DEFAULT data when switching to LCF
        if (allResults.length === 0) {
          const { data: oldDefaults } = await supabase
            .from("dre_periods")
            .select("id")
            .eq("user_id", userId)
            .eq("sheet_id", connection_id)
            .eq("template_type", "DEFAULT");

          if (oldDefaults && oldDefaults.length > 0) {
            const oldIds = oldDefaults.map((p: any) => p.id);
            await supabase.from("dre_validation_issues").delete().in("period_id", oldIds);
            await supabase.from("dre_lines").delete().in("period_id", oldIds);
            await supabase.from("dre_periods").delete().in("id", oldIds);
          }
        }

        for (const entry of lcfTabs) {
          const importResult = await importLcfTab(entry.rows, entry.tab, userId, connection_id, supabase);
          allResults.push({
            success: true, found: true, tab_name: entry.tab,
            template: "LCF_NUCLEO", parser: "lcf_nucleo",
            periods_count: 1, lines_count: importResult.linesCount,
            periods: [importResult.periodKey],
            warnings: importResult.warnings,
          });
          processedTabs.add(entry.tab);
        }
      }

      // Process DEFAULT/Matrix tabs
      const matrixEntries = defaultTabs.filter(e => e.matrixDetect?.isMatrix);
      
      if (matrixEntries.length > 0) {
        // Year-scoped cleanup per matrix tab
        for (const entry of matrixEntries) {
          if (normalize(entry.tab).includes("teste")) continue;
          
          const dreYear = extractYearFromTab(entry.tab, entry.rows);
          console.log(`[dre-sync] Using MATRIX parser for tab "${entry.tab}" (year=${dreYear})`);
          
          // Year-scoped cleanup: only delete periods for THIS year
          if (dreYear) {
            const { data: oldPeriods } = await supabase
              .from("dre_periods")
              .select("id, period_key")
              .eq("user_id", userId)
              .eq("sheet_id", connection_id)
              .eq("template_type", "DEFAULT");

            if (oldPeriods && oldPeriods.length > 0) {
              const yearStr = String(dreYear);
              const periodsToDelete = oldPeriods.filter((p: any) => 
                p.period_key.startsWith(yearStr) || p.period_key === "TOTAL"
              );
              if (periodsToDelete.length > 0) {
                const oldIds = periodsToDelete.map((p: any) => p.id);
                await supabase.from("dre_validation_issues").delete().in("period_id", oldIds);
                await supabase.from("dre_lines").delete().in("period_id", oldIds);
                await supabase.from("dre_periods").delete().in("id", oldIds);
              }
            }
          }

          const result = await parseDreMatrix(entry.rows, entry.tab, userId, connection_id, supabase, entry.matrixDetect!, true, dreYear || undefined);
          if (result.success) {
            allResults.push(result);
            processedTabs.add(entry.tab);
          }
        }
      }
      
      // Fallback single DEFAULT tab
      const nonMatrixDefaults = defaultTabs.filter(e => !e.matrixDetect?.isMatrix);
      if (nonMatrixDefaults.length > 0 && allResults.length === 0) {
        const entry = nonMatrixDefaults[0];
        const result = await parseDefaultDre(entry.rows, entry.tab, userId, connection_id, supabase);
        if (result.success) {
          allResults.push(result);
          processedTabs.add(entry.tab);
        }
      }
    }

    // 8. Return combined results
    if (allResults.length === 0) {
      return new Response(JSON.stringify({
        success: false, found: true,
        message: "Abas DRE encontradas mas sem dados suficientes para importação.",
        available_tabs: sheetTitles,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const totalLines = allResults.reduce((s, r) => s + (r.lines_count || 0), 0);
    const totalPeriods = allResults.reduce((s, r) => s + (r.periods_count || 0), 0);
    const totalWarnings = allResults.reduce((s, r) => s + (r.warnings || 0), 0);

    return new Response(JSON.stringify({
      success: true, found: true,
      template: allResults[0].template,
      tabs_imported: allResults.length,
      periods_count: totalPeriods,
      lines_count: totalLines,
      periods: allResults.flatMap(r => r.periods || []),
      warnings: totalWarnings,
      models_detected: allResults.map(r => ({ tab: r.tab_name, model: r.template || r.parser, year: r.dre_year })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("DRE sync error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
