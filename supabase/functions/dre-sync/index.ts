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

  // Pattern: "abr./25", "abr/25", "abr./2025", "mai/2025"
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
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    return { periodKey: `${y}-${m}`, label };
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
  "total geral", "resultado final",
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

  // "jan26", "jan/26", "jan/2026", "jan 26", "jan.26"
  const m1 = norm.match(/^([a-z]{3,})\.?\s*[\/\-\s]?\s*(\d{2,4})$/);
  if (m1) {
    const monthNum = MONTH_ABBREVS[m1[1]];
    if (monthNum) {
      const year = m1[2].length === 2 ? `20${m1[2]}` : m1[2];
      return `${year}-${monthNum}`;
    }
  }

  // "01-2026", "01/2026", "01/26"
  const m2 = norm.match(/^(\d{1,2})[\/\-]\s*(\d{2,4})$/);
  if (m2) {
    const month = m2[1].padStart(2, "0");
    const year = m2[2].length === 2 ? `20${m2[2]}` : m2[2];
    if (parseInt(month) >= 1 && parseInt(month) <= 12) {
      return `${year}-${month}`;
    }
  }

  // Bare month "jan", "fev" (no year — return null for NEEDS_REVIEW)
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
      // Try patterns like "jan.2026", "fev/26", "02/2026", "Janeiro 2026"
      const parsed = parseMonthHeader(s);
      if (parsed && parsed.periodKey !== "TOTAL") return parsed.periodKey;
    }
  }
  return null;
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
  // Order matters: more specific first
  if (n.includes("despesas totais") && n.includes("escritorio")) return "DESPESAS_ESCRITORIO";
  if (n.includes("despesas totais") && n.includes("nucleo")) return "DESPESAS_NUCLEO";
  if (n.includes("despesas totais")) return "DESPESAS_NUCLEO";
  if (n.includes("receita bruta")) return "RECEITA_BRUTA";
  if (n.includes("sobra de cada nucleo") || n.includes("sobra")) return "SOBRA";
  if (n.includes("lucro distribuido") || n.includes("distribuicao")) return "DISTRIBUICAO";
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
  // 1. Extract period
  let periodKey = extractPeriodFromTabName(sheetName);
  if (!periodKey) {
    periodKey = extractPeriodFromContent(rows);
  }

  // 2. Find nucleo columns in header rows (first 10 rows)
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

  // 3. Parse lines
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
      // Parse value per nucleo
      for (const nc of nucleoColumns) {
        const cellVal = row?.[nc.colIndex];
        const parsed = parseBRL(cellVal);

        if (parsed !== null || isGroup || isSubtotal) {
          lines.push({
            label,
            section: currentSection,
            nucleo: nc.name,
            value: parsed ?? 0,
            order: order,
            isGroup,
            isSubtotal,
            groupLabel: isGroup ? label : currentGroup,
            sourceCell: `${sheetName}!${colToLetter(nc.colIndex)}${r + 1}`,
          });
        }
      }

      // Also create consolidated line (sum of nucleos)
      const values = nucleoColumns.map(nc => parseBRL(row?.[nc.colIndex]));
      const hasAny = values.some(v => v !== null);
      if (hasAny || isGroup || isSubtotal) {
        const consolidated = values.reduce((sum, v) => (sum ?? 0) + (v ?? 0), 0) ?? 0;
        lines.push({
          label,
          section: currentSection,
          nucleo: null, // consolidated
          value: consolidated,
          order: order,
          isGroup,
          isSubtotal,
          groupLabel: isGroup ? label : currentGroup,
          sourceCell: `${sheetName}!A${r + 1}`,
        });
      }
    } else {
      // Fallback: single column (col B)
      const val = parseBRL(row?.[1]);
      if (val !== null || isGroup || isSubtotal) {
        lines.push({
          label,
          section: currentSection,
          nucleo: null,
          value: val ?? 0,
          order: order,
          isGroup,
          isSubtotal,
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

  // Get consolidated lines (nucleo IS NULL)
  const consolidated = lines.filter(l => l.nucleo === null);

  const findBySection = (section: string) =>
    consolidated.find(l => l.section === section && l.isSubtotal);

  const receitaBruta = findBySection("RECEITA_BRUTA");
  const despesasNucleo = findBySection("DESPESAS_NUCLEO");
  const resultado = findBySection("RESULTADO");

  // Check: Resultado ~= Receita Bruta - Despesas Nucleo
  if (receitaBruta && despesasNucleo && resultado) {
    const expected = receitaBruta.value + despesasNucleo.value; // despesas are negative
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

  // Per-nucleo checks
  for (const nucleoName of ["AMBIENTAL", "PENAL"]) {
    const nLines = lines.filter(l => l.nucleo === nucleoName);
    const nReceita = nLines.find(l => l.section === "RECEITA_BRUTA" && l.isSubtotal);
    const nDespesa = nLines.find(l => l.section === "DESPESAS_NUCLEO" && l.isSubtotal);
    const nResultado = nLines.find(l => l.section === "RESULTADO" && l.isSubtotal);

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

// ========== DEFAULT PARSER (existing logic, untouched) ==========

async function parseDefaultDre(
  rows: string[][],
  dreTab: string,
  userId: string,
  connectionId: string,
  supabase: any,
) {
  // Detect header row
  let headerRowIndex = -1;
  let monthCols: Array<{ colIndex: number; periodKey: string; label: string }> = [];
  let totalColIndex = -1;

  for (let rowIdx = 0; rowIdx < Math.min(rows.length, 10); rowIdx++) {
    const row = rows[rowIdx];
    const candidates: Array<{ colIndex: number; periodKey: string; label: string }> = [];
    let foundTotal = -1;

    for (let colIdx = 1; colIdx < row.length; colIdx++) {
      const val = row[colIdx];
      if (!val || !val.trim()) continue;
      if (normalize(val) === "total") { foundTotal = colIdx; continue; }
      const parsed = parseMonthHeader(val);
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

  // Parse data rows
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

  // Build period columns
  const periodColumns = [
    ...monthCols.map(m => ({ colIndex: m.colIndex, periodKey: m.periodKey, periodLabel: m.label })),
  ];
  if (totalColIndex >= 0) {
    periodColumns.push({ colIndex: totalColIndex, periodKey: "TOTAL", periodLabel: "TOTAL" });
  }

  // Delete old data
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

  // Validation
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

  // Delete old period for this key+connection+template
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

  // Insert period
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

  // Insert lines
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

  // Validate
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
  const range = encodeURIComponent(`'${tabName}'!A1:Z200`);
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

    // 5. Process each tab
    const results: Array<{ tab: string; template: string; periodKey: string | null; lines: number; status: string; warnings: number }> = [];
    const defaultTabs: string[] = [];
    const lcfTabs: string[] = [];

    // First pass: classify all tabs
    const tabClassification: Array<{ tab: string; template: "LCF_NUCLEO" | "DEFAULT"; rows: string[][] }> = [];
    for (const tab of candidateTabs) {
      const rows = await readTabData(tab, accessToken!, connection.spreadsheet_id, xlsxWorkbook);
      if (rows.length < 2) continue;
      const template = detectDreTemplate(rows);
      tabClassification.push({ tab, template, rows });
      if (template === "LCF_NUCLEO") lcfTabs.push(tab);
      else defaultTabs.push(tab);
    }

    // Process DEFAULT tabs: use original parser with first DEFAULT tab only
    if (defaultTabs.length > 0 && lcfTabs.length === 0) {
      // Pure DEFAULT mode: use first tab with multi-month columns
      const defaultEntry = tabClassification.find(t => t.template === "DEFAULT")!;
      const result = await parseDefaultDre(defaultEntry.rows, defaultEntry.tab, userId, connection_id, supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process LCF tabs: each tab = one month
    if (lcfTabs.length > 0) {
      // Delete old DEFAULT periods for this connection (switching template)
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
          tab: entry.tab,
          template: "LCF_NUCLEO",
          periodKey: importResult.periodKey,
          lines: importResult.linesCount,
          status: importResult.status,
          warnings: importResult.warnings,
        });
      }

      const totalLines = results.reduce((s, r) => s + r.lines, 0);
      const totalWarnings = results.reduce((s, r) => s + r.warnings, 0);

      return new Response(JSON.stringify({
        success: true,
        found: true,
        template: "LCF_NUCLEO",
        tabs_imported: results.length,
        periods_count: results.length,
        lines_count: totalLines,
        periods: results.map(r => r.periodKey).filter(Boolean),
        warnings: totalWarnings,
        details: results,
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
