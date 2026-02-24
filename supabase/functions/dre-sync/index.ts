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

function parseBRL(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  let str = String(value).trim();
  if (!str) return null;
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;

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

/**
 * Enhanced parseBRL for matrix DRE: tries current cell, and if it only has "R$",
 * looks at the next cell for the actual number.
 */
function parseBRLFromCells(row: any[], colIndex: number): number | null {
  const cell = row?.[colIndex];
  const parsed = parseBRL(cell);
  if (parsed !== null) return parsed;
  
  // Check if current cell is just "R$" and next cell has the number
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

  // Pattern: "abr./25", "abr/25", "abr./2025", "mai/2025", "jan-25"
  const m1 = norm.match(/^([a-z]{3,})\.?\s*[\/\-]\s*(\d{2,4})$/);
  if (m1) {
    const monthNum = MONTH_ABBREVS[m1[1]];
    if (monthNum) {
      const year = m1[2].length === 2 ? (parseInt(m1[2]) > 50 ? `19${m1[2]}` : `20${m1[2]}`) : m1[2];
      return { periodKey: `${year}-${monthNum}`, label };
    }
  }

  // Pattern: "04/2025" or "04/25"
  const m2 = norm.match(/^(\d{1,2})[\/\-](\d{2,4})$/);
  if (m2) {
    const month = m2[1].padStart(2, "0");
    const year = m2[2].length === 2 ? (parseInt(m2[2]) > 50 ? `19${m2[2]}` : `20${m2[2]}`) : m2[2];
    if (parseInt(month) >= 1 && parseInt(month) <= 12) {
      return { periodKey: `${year}-${month}`, label };
    }
  }

  // Excel serial date number
  const serial = parseFloat(norm);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const date = new Date((serial - 25569) * 86400000);
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth(); // 0-indexed
    const mStr = String(m + 1).padStart(2, "0");
    const MONTH_NAMES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const friendlyLabel = `${MONTH_NAMES_PT[m]}/${y}`;
    return { periodKey: `${y}-${mStr}`, label: friendlyLabel };
  }

  // ISO date "2025-04-01"
  const m3 = norm.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (m3) {
    return { periodKey: `${m3[1]}-${m3[2]}`, label };
  }

  return null;
}

// ========== SUBTOTAL DETECTION ==========

const SUBTOTAL_KEYWORDS = [
  "receita liquida", "resultado", "despesas totais", "lucro bruto",
  "ebitda", "resultado mes", "resultado do mes", "total despesas",
  "resultado operacional", "resultado liquido", "lucro liquido",
  "total geral", "resultado final", "lucro operacional",
  "faturamento", "deducoes",
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

// ========== DRE TAB DETECTION (multi-tab aware) ==========

/** Returns ALL tabs whose name contains "DRE" (case-insensitive) */
function listCandidateDreSheets(sheetTitles: string[]): string[] {
  return sheetTitles.filter(t => normalize(t).includes("dre"));
}

/** Detect if a single tab uses LCF_NUCLEO template */
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

/** Extract period (YYYY-MM) from tab name like "DRE Jan26", "DRE Fev/2026", "DRE 02-2026" */
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

  const bareMonth = MONTH_ABBREVS[norm];
  if (bareMonth) return null;

  return null;
}

/** Extract period from content headers (first few rows) */
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
  "lucro operacional", "resultado operacional", "lucro liquido", "resultado liquido",
];

const MATRIX_EXCLUDE_KEYWORDS = [
  "chris", "michelle", "denise", "controle denise", "total denise",
  "total recebido direto", "total a receber", "rateio", "comissao", "distribuicao",
  "participacao", "participacoes", "reserva",
];

interface MatrixDetectResult {
  isMatrix: boolean;
  headerRowIndex: number;
  labelColIndex: number;
  monthCols: Array<{ colIndex: number; periodKey: string; label: string }>;
  totalColIndex: number;
}

/**
 * Detect if a DRE tab uses horizontal matrix format (months as columns).
 * Searches more rows (up to 20) and looks for DRE section markers.
 */
function detectDreMatrix(rows: string[][]): MatrixDetectResult {
  const fail: MatrixDetectResult = { isMatrix: false, headerRowIndex: -1, labelColIndex: 0, monthCols: [], totalColIndex: -1 };
  
  // Look for section markers that indicate a DRE structure
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

  const hasSections = (hasFaturamento || hasDeducoes) && (hasReceitaLiquida || hasDespesasTotais || hasLucroOperacional);

  // Search for month header row (up to row 20)
  for (let rowIdx = 0; rowIdx < Math.min(rows.length, 20); rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;
    
    const candidates: Array<{ colIndex: number; periodKey: string; label: string }> = [];
    let foundTotal = -1;
    let labelCol = 0;

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

    // Need at least 2 months to be a valid matrix header
    if (candidates.length >= 2) {
      // Label column is typically the first column before the month columns
      const firstMonthCol = Math.min(...candidates.map(c => c.colIndex));
      labelCol = firstMonthCol > 0 ? firstMonthCol - 1 : 0;
      
      // Check if there might be a "R$" column between label and values
      // If the column before months has "R$" patterns, shift label back
      const possibleRsCol = normalize(String(row[labelCol] ?? ""));
      if (possibleRsCol === "r$" || possibleRsCol === "") {
        labelCol = Math.max(0, labelCol - 1);
      }

      return {
        isMatrix: true,
        headerRowIndex: rowIdx,
        labelColIndex: labelCol,
        monthCols: candidates,
        totalColIndex: foundTotal,
      };
    }
  }

  // If we found DRE section markers but no month columns, it's still possibly a matrix
  // but we can't parse it without months
  if (hasSections) {
    console.log("[dre-sync] Found DRE section markers but no month header columns");
  }

  return fail;
}

// ========== MATRIX DRE PARSER (Format C) ==========

async function parseDreMatrix(
  rows: string[][],
  dreTab: string,
  userId: string,
  connectionId: string,
  supabase: any,
  detection: MatrixDetectResult,
) {
  const { headerRowIndex, labelColIndex, monthCols, totalColIndex } = detection;
  
  console.log(`[dre-sync] Matrix DRE: header at row ${headerRowIndex}, label col ${labelColIndex}, ${monthCols.length} months, total col ${totalColIndex}`);

  // Build period columns
  const periodColumns = [
    ...monthCols.map(m => ({ colIndex: m.colIndex, periodKey: m.periodKey, periodLabel: m.label })),
  ];
  if (totalColIndex >= 0) {
    periodColumns.push({ colIndex: totalColIndex, periodKey: "TOTAL", periodLabel: "TOTAL" });
  }
  
  const allValueCols = periodColumns.map(p => p.colIndex);

  // Parse data rows - stop at LUCRO OPERACIONAL or end
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
    // Try label column; also check adjacent columns if empty
    let label = String(row?.[labelColIndex] ?? "").trim();
    if (!label && labelColIndex > 0) {
      label = String(row?.[labelColIndex - 1] ?? "").trim();
    }
    if (!label && labelColIndex + 1 < (row?.length ?? 0)) {
      label = String(row?.[labelColIndex + 1] ?? "").trim();
    }
    if (!label) continue;

    const normLabel = normalize(label);
    
    // Check exclusion list (blocks below main DRE)
    if (MATRIX_EXCLUDE_KEYWORDS.some(kw => normLabel.includes(kw))) {
      console.log(`[dre-sync] Matrix: excluding line "${label}" (matches exclusion keyword)`);
      continue;
    }
    
    // Skip "R$" only cells that aren't real labels
    if (/^R\$?\s*$/.test(label)) continue;
    // Skip "DRE 20XX" title rows
    if (/^DRE\s+\d{4}/i.test(label)) continue;

    const isGroup = isGroupLabel(label);
    const isSubtotal = isSubtotalLabel(label);
    if (isGroup) currentGroup = label;

    // Parse values from each month/total column
    const values = new Map<number, number>();
    let hasAnyValue = false;
    for (const colIdx of allValueCols) {
      // Use enhanced parser that handles R$ in adjacent cells
      const parsed = parseBRLFromCells(row, colIdx);
      if (parsed !== null) { values.set(colIdx, parsed); hasAnyValue = true; }
    }
    
    if (!hasAnyValue && !isGroup) continue;

    parsedLines.push({ label, rowIndex: rowIdx, isGroup, isSubtotal, groupLabel: isGroup ? label : currentGroup, values });

    // Check if we hit the stop line (LUCRO OPERACIONAL etc.) - include it but stop after
    if (MATRIX_DRE_STOP_KEYWORDS.some(kw => normLabel.includes(kw))) {
      console.log(`[dre-sync] Matrix: reached stop line "${label}" at row ${rowIdx + 1}`);
      reachedStop = true;
    }
  }

  if (parsedLines.length === 0) {
    return { success: false, found: true, message: "DRE matricial detectada mas sem linhas válidas." };
  }

  // Validate: check for key lines
  const hasKeyLines = parsedLines.some(l => {
    const n = normalize(l.label);
    return n.includes("receita liquida") || n.includes("despesas totais") || n.includes("lucro operacional") || n.includes("faturamento");
  });
  
  if (!hasKeyLines) {
    console.log(`[dre-sync] Matrix: no key DRE lines found, parsed ${parsedLines.length} lines`);
  }

  console.log(`[dre-sync] Matrix: parsed ${parsedLines.length} lines for ${periodColumns.length} periods`);

  // Delete old data for this connection with DEFAULT template (matrix uses DEFAULT type)
  const { data: oldPeriods } = await supabase
    .from("dre_periods")
    .select("id")
    .eq("user_id", userId)
    .eq("sheet_id", connectionId)
    .eq("template_type", "DEFAULT");

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
    template_type: "DEFAULT",
  }));

  const { data: insertedPeriods, error: periodError } = await supabase
    .from("dre_periods").insert(periodInserts).select("id, period_key, col_index");
  if (periodError) throw new Error(`Failed to insert periods: ${periodError.message}`);

  const periodMap = new Map<string, { id: string; colIndex: number }>();
  for (const p of insertedPeriods || []) {
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
    const { error: lineError } = await supabase.from("dre_lines").insert(batch);
    if (lineError) throw new Error(`Failed to insert lines batch: ${lineError.message}`);
    totalInserted += batch.length;
  }

  // Validation: check totals match sum of months
  const validationUpdates: Array<{ periodId: string; status: string; notes: string[] }> = [];
  
  if (totalColIndex >= 0) {
    const totalPeriodData = periodMap.get("TOTAL");
    if (totalPeriodData) {
      const notes: string[] = [];
      for (const line of parsedLines) {
        if (line.isGroup) continue;
        const totalVal = line.values.get(totalColIndex);
        if (totalVal === undefined) continue;
        
        const monthSum = monthCols.reduce((sum, mc) => {
          const v = line.values.get(mc.colIndex);
          return sum + (v ?? 0);
        }, 0);
        
        const diff = Math.abs(totalVal - monthSum);
        if (diff > 0.02) {
          notes.push(`"${line.label}": TOTAL=${totalVal.toFixed(2)}, soma meses=${monthSum.toFixed(2)}, diff=${diff.toFixed(2)}`);
        }
      }
      if (notes.length > 0) {
        validationUpdates.push({ periodId: totalPeriodData.id, status: "warning", notes: notes.slice(0, 10) });
      }
    }
  }

  for (const vu of validationUpdates) {
    await supabase.from("dre_periods").update({ validation_status: vu.status, validation_notes: vu.notes }).eq("id", vu.periodId);
  }

  return {
    success: true, found: true, tab_name: dreTab, template: "DEFAULT",
    parser: "dre_matricial",
    periods_count: periodColumns.length, lines_count: totalInserted,
    periods: periodColumns.map(p => p.periodKey), warnings: validationUpdates.length,
  };
}

// ========== LCF NUCLEO PARSER ==========

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

    if (sectionDetected) {
      currentSection = sectionDetected;
    }
    if (isGroup) {
      currentGroup = label;
    }

    if (nucleoColumns.length >= 2) {
      for (const nc of nucleoColumns) {
        const cellVal = row?.[nc.colIndex];
        const parsed = parseBRL(cellVal);

        if (parsed !== null || isGroup || isSubtotal) {
          lines.push({
            label, section: currentSection, nucleo: nc.name,
            value: parsed ?? 0, order: order, isGroup, isSubtotal,
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
          value: consolidated, order: order, isGroup, isSubtotal,
          groupLabel: isGroup ? label : currentGroup,
          sourceCell: `${sheetName}!A${r + 1}`,
        });
      }
    } else {
      const val = parseBRL(row?.[1]);
      if (val !== null || isGroup || isSubtotal) {
        lines.push({
          label, section: currentSection, nucleo: null,
          value: val ?? 0, order: order, isGroup, isSubtotal,
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

// ========== DEFAULT PARSER (existing logic) ==========

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
    periodColumns.push({ colIndex: totalColIndex, periodKey: "TOTAL", periodLabel: "TOTAL" });
  }

  const { data: oldPeriods } = await supabase
    .from("dre_periods")
    .select("id")
    .eq("user_id", userId)
    .eq("sheet_id", connectionId)
    .eq("template_type", "DEFAULT");

  if (oldPeriods && oldPeriods.length > 0) {
    const oldIds = oldPeriods.map((p: any) => p.id);
    await supabase.from("dre_validation_issues").delete().in("period_id", oldIds);
    await supabase.from("dre_lines").delete().in("period_id", oldIds);
    await supabase.from("dre_periods").delete().in("id", oldIds);
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

  const validationUpdates: Array<{ periodId: string; status: string; notes: string[] }> = [];
  for (const [_pKey, pData] of periodMap.entries()) {
    const periodLines = lineInserts.filter((l: any) => l.period_id === pData.id && !l.is_group);
    const notes: string[] = [];
    const getGroupItems = (groupNorm: string) =>
      periodLines.filter((l: any) => l.group_label && normalize(l.group_label).includes(groupNorm) && !l.is_subtotal && !l.is_group);
    const getSubtotal = (keyword: string) =>
      periodLines.find((l: any) => l.is_subtotal && normalize(l.line_label).includes(keyword));

    const faturamentoItems = getGroupItems("faturamento");
    const deducoesItems = getGroupItems("deducoe");
    const recLiqSubtotal = getSubtotal("receita liquida");
    if (faturamentoItems.length > 0 && recLiqSubtotal) {
      const sumFat = faturamentoItems.reduce((s: number, l: any) => s + l.value, 0);
      const sumDed = deducoesItems.reduce((s: number, l: any) => s + l.value, 0);
      const expected = sumFat + sumDed;
      if (Math.abs(recLiqSubtotal.value - expected) > 0.01) {
        notes.push(`Receita Líquida diverge: planilha=${recLiqSubtotal.value}, calculado=${expected.toFixed(2)}`);
      }
    }
    const despesasItems = getGroupItems("despesa");
    const despTotalSubtotal = getSubtotal("despesas totais") || getSubtotal("total despesas");
    if (despesasItems.length > 0 && despTotalSubtotal) {
      const sumDesp = despesasItems.reduce((s: number, l: any) => s + l.value, 0);
      if (Math.abs(despTotalSubtotal.value - sumDesp) > 0.01) {
        notes.push(`Despesas Totais diverge: planilha=${despTotalSubtotal.value}, calculado=${sumDesp.toFixed(2)}`);
      }
    }
    if (notes.length > 0) validationUpdates.push({ periodId: pData.id, status: "warning", notes });
  }

  for (const vu of validationUpdates) {
    await supabase.from("dre_periods").update({ validation_status: vu.status, validation_notes: vu.notes }).eq("id", vu.periodId);
  }

  return {
    success: true, found: true, tab_name: dreTab, template: "DEFAULT",
    periods_count: periodColumns.length, lines_count: totalInserted,
    periods: periodColumns.map(p => p.periodKey), warnings: validationUpdates.length,
  };
}

// ========== LCF IMPORT ==========

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
  // Increased range to support larger DRE sheets
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

    console.log(`Found ${candidateTabs.length} DRE candidate tabs: ${candidateTabs.join(", ")}`);

    // 5. Process each tab - classify first
    const results: Array<{ tab: string; template: string; periodKey: string | null; lines: number; status: string; warnings: number }> = [];
    const lcfTabs: string[] = [];

    const tabClassification: Array<{ tab: string; template: "LCF_NUCLEO" | "DEFAULT"; rows: string[][]; matrixDetect: MatrixDetectResult | null }> = [];
    for (const tab of candidateTabs) {
      const rows = await readTabData(tab, accessToken!, connection.spreadsheet_id, xlsxWorkbook);
      if (rows.length < 2) continue;
      const template = detectDreTemplate(rows);
      
      // For DEFAULT tabs, also check if it's a matrix format
      let matrixDetect: MatrixDetectResult | null = null;
      if (template === "DEFAULT") {
        matrixDetect = detectDreMatrix(rows);
      }
      
      tabClassification.push({ tab, template, rows, matrixDetect });
      if (template === "LCF_NUCLEO") lcfTabs.push(tab);
    }

    // Process DEFAULT tabs (including matrix format)
    if (lcfTabs.length === 0) {
      const defaultEntries = tabClassification.filter(t => t.template === "DEFAULT");
      
      // Check if ANY tab is matrix format
      const matrixEntries = defaultEntries.filter(e => e.matrixDetect?.isMatrix);
      
      if (matrixEntries.length > 0) {
        // Multiple matrix DRE tabs (e.g. DRE 2024, DRE 2025, DRE 2026)
        // Delete all old DEFAULT data first, then import all tabs
        const { data: oldPeriods } = await supabase
          .from("dre_periods")
          .select("id")
          .eq("user_id", userId)
          .eq("sheet_id", connection_id)
          .eq("template_type", "DEFAULT");

        if (oldPeriods && oldPeriods.length > 0) {
          const oldIds = oldPeriods.map((p: any) => p.id);
          await supabase.from("dre_validation_issues").delete().in("period_id", oldIds);
          await supabase.from("dre_lines").delete().in("period_id", oldIds);
          await supabase.from("dre_periods").delete().in("id", oldIds);
        }

        // Sort by tab name descending so latest year is first in results
        matrixEntries.sort((a, b) => b.tab.localeCompare(a.tab));
        
        let totalLines = 0;
        let totalPeriods = 0;
        let totalWarnings = 0;
        const allPeriods: string[] = [];
        const tabResults: any[] = [];

        for (const entry of matrixEntries) {
          // Skip tabs with "TESTES" in name
          if (normalize(entry.tab).includes("teste")) {
            console.log(`[dre-sync] Skipping test tab: ${entry.tab}`);
            continue;
          }
          console.log(`[dre-sync] Using MATRIX parser for tab "${entry.tab}"`);
          // parseDreMatrix already handles its own insert, but we already cleared old data above
          // We need a version that doesn't re-delete. For simplicity, just call it - it will
          // try to delete again but find nothing (already cleared).
          const result = await parseDreMatrix(entry.rows, entry.tab, userId, connection_id, supabase, entry.matrixDetect!);
          if (result.success) {
            totalLines += result.lines_count || 0;
            totalPeriods += result.periods_count || 0;
            totalWarnings += result.warnings || 0;
            allPeriods.push(...(result.periods || []));
            tabResults.push({ tab: entry.tab, ...result });
          }
        }

        return new Response(JSON.stringify({
          success: totalLines > 0,
          found: true,
          template: "DEFAULT",
          parser: "dre_matricial",
          tabs_imported: tabResults.length,
          periods_count: totalPeriods,
          lines_count: totalLines,
          periods: allPeriods,
          warnings: totalWarnings,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      if (defaultEntries.length > 0) {
        // Fallback to original DEFAULT parser (single tab)
        const entry = defaultEntries[0];
        console.log(`[dre-sync] Using DEFAULT parser for tab "${entry.tab}"`);
        const result = await parseDefaultDre(entry.rows, entry.tab, userId, connection_id, supabase);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Process LCF tabs: each tab = one month
    if (lcfTabs.length > 0) {
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

      for (const entry of tabClassification.filter(t => t.template === "LCF_NUCLEO")) {
        const importResult = await importLcfTab(entry.rows, entry.tab, userId, connection_id, supabase);
        results.push({
          tab: entry.tab, template: "LCF_NUCLEO",
          periodKey: importResult.periodKey, lines: importResult.linesCount,
          status: importResult.status, warnings: importResult.warnings,
        });
      }

      const totalLines = results.reduce((s, r) => s + r.lines, 0);
      const totalWarnings = results.reduce((s, r) => s + r.warnings, 0);

      return new Response(JSON.stringify({
        success: true, found: true, template: "LCF_NUCLEO",
        tabs_imported: results.length, periods_count: results.length,
        lines_count: totalLines,
        periods: results.map(r => r.periodKey).filter(Boolean),
        warnings: totalWarnings, details: results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fallback
    return new Response(JSON.stringify({
      success: false, found: true,
      message: "Abas DRE encontradas mas sem dados suficientes para importação.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("DRE sync error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
