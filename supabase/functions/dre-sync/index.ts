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
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function parseMonthHeader(raw: string): { periodKey: string; label: string } | null {
  const label = raw.trim();
  if (!label) return null;
  const norm = normalize(label);

  // Check if it's "TOTAL"
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

  // Excel serial date number (days since 1900-01-01)
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

  // Bare month abbreviation without year (skip, ambiguous)
  return null;
}

function looksLikeMonthOrDate(val: string): boolean {
  return parseMonthHeader(val) !== null;
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
  // All uppercase (at least 3 chars, ignoring spaces/special)
  const letters = trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true;
  return false;
}

// ========== DRE TAB DETECTION ==========

function detectDRETab(sheetTitles: string[]): string | null {
  // Exact match first
  for (const title of sheetTitles) {
    if (title.trim().toUpperCase() === "DRE") return title;
  }
  // Fuzzy match
  const dreKeywords = ["dre", "demonstracao", "demonstração", "resultado"];
  for (const title of sheetTitles) {
    const norm = normalize(title);
    if (dreKeywords.some(k => norm.includes(k))) return title;
  }
  return null;
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

    // 2. Refresh token if needed
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

    // 3. Detect file type
    const fileInfo = await getFileMimeType(accessToken!, connection.spreadsheet_id);
    const isXlsx = fileInfo.mimeType === XLSX_MIME;
    let xlsxWorkbook: any = null;
    if (isXlsx) {
      xlsxWorkbook = await downloadXlsxWorkbook(accessToken!, connection.spreadsheet_id);
    }

    // 3b. Get sheet titles
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

    // 4. Auto-detect DRE tab
    const dreTab = detectDRETab(sheetTitles);
    if (!dreTab) {
      return new Response(JSON.stringify({
        success: false, found: false,
        message: "Aba DRE não encontrada na planilha. Crie uma aba chamada 'DRE' com os dados do demonstrativo.",
        available_tabs: sheetTitles,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. Read entire DRE tab
    let rows: string[][];
    if (xlsxWorkbook) {
      rows = xlsxSheetToRows(xlsxWorkbook, dreTab);
    } else {
      const range = encodeURIComponent(`'${dreTab}'!A1:Z200`);
      const dataRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}/values/${range}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!dataRes.ok) throw new Error("Failed to read DRE tab");
      const sheetData = await dataRes.json();
      rows = sheetData.values || [];
    }

    if (rows.length < 2) {
      return new Response(JSON.stringify({
        success: false, found: true,
        message: "Aba DRE encontrada mas está vazia ou com dados insuficientes.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 6. Detect header row (first row with 3+ consecutive month-like values from col B onwards)
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

        if (normalize(val) === "total") {
          foundTotal = colIdx;
          continue;
        }

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
      return new Response(JSON.stringify({
        success: false, found: true,
        message: "Não foi possível detectar o header de meses na aba DRE. Verifique se existem colunas com meses (ex: abr./25, mai./25).",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Header found at row ${headerRowIndex + 1}, ${monthCols.length} month columns, total col: ${totalColIndex >= 0 ? colToLetter(totalColIndex) : 'none'}`);

    // 7. Parse all data rows below header
    interface ParsedLine {
      label: string;
      rowIndex: number;
      isGroup: boolean;
      isSubtotal: boolean;
      groupLabel: string | null;
      values: Map<number, number>; // colIndex -> value
    }

    const parsedLines: ParsedLine[] = [];
    let currentGroup: string | null = null;
    const allValueCols = [...monthCols.map(m => m.colIndex)];
    if (totalColIndex >= 0) allValueCols.push(totalColIndex);

    for (let rowIdx = headerRowIndex + 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const label = row?.[0]?.trim() || "";

      // Empty label => ignore (subtotal duplicate)
      if (!label) continue;

      const isGroup = isGroupLabel(label);
      const isSubtotal = isSubtotalLabel(label);

      if (isGroup) {
        currentGroup = label;
      }

      // Extract numeric values from all month + total columns
      const values = new Map<number, number>();
      let hasAnyValue = false;

      for (const colIdx of allValueCols) {
        const cellVal = row?.[colIdx];
        const parsed = parseBRL(cellVal);
        if (parsed !== null) {
          values.set(colIdx, parsed);
          hasAnyValue = true;
        }
      }

      // Only save if at least one numeric value exists
      if (!hasAnyValue && !isGroup) continue;

      parsedLines.push({
        label,
        rowIndex: rowIdx,
        isGroup,
        isSubtotal,
        groupLabel: isGroup ? label : currentGroup,
        values,
      });
    }

    console.log(`Parsed ${parsedLines.length} valid lines`);

    // 8. Build period columns (months + TOTAL)
    const periodColumns: Array<{ colIndex: number; periodKey: string; periodLabel: string }> = [
      ...monthCols.map(m => ({ colIndex: m.colIndex, periodKey: m.periodKey, periodLabel: m.label })),
    ];
    if (totalColIndex >= 0) {
      periodColumns.push({ colIndex: totalColIndex, periodKey: "TOTAL", periodLabel: "TOTAL" });
    }

    // 9. Delete old data and insert new
    // Delete old dre_lines first (cascade from dre_periods), then dre_periods
    const { data: oldPeriods } = await supabase
      .from("dre_periods")
      .select("id")
      .eq("user_id", userId)
      .eq("sheet_id", connection_id);

    if (oldPeriods && oldPeriods.length > 0) {
      const oldPeriodIds = oldPeriods.map(p => p.id);
      await supabase.from("dre_lines").delete().in("period_id", oldPeriodIds);
      await supabase.from("dre_periods").delete().eq("user_id", userId).eq("sheet_id", connection_id);
    }

    // 10. Insert dre_periods
    const periodInserts = periodColumns.map((pc, idx) => ({
      user_id: userId,
      sheet_id: connection_id,
      period_key: pc.periodKey,
      period_label: pc.periodLabel,
      col_index: pc.colIndex,
      validation_status: "ok",
      validation_notes: [],
      last_import_at: new Date().toISOString(),
    }));

    const { data: insertedPeriods, error: periodError } = await supabase
      .from("dre_periods")
      .insert(periodInserts)
      .select("id, period_key, col_index");

    if (periodError) throw new Error(`Failed to insert periods: ${periodError.message}`);

    const periodMap = new Map<string, { id: string; colIndex: number }>();
    for (const p of insertedPeriods || []) {
      periodMap.set(p.period_key, { id: p.id, colIndex: p.col_index });
    }

    // 11. Insert dre_lines (one per line per period)
    const lineInserts: Array<{
      period_id: string;
      user_id: string;
      group_label: string | null;
      line_label: string;
      value: number;
      source_cell: string;
      source_tab: string;
      order_index: number;
      is_group: boolean;
      is_subtotal: boolean;
    }> = [];

    for (let lineIdx = 0; lineIdx < parsedLines.length; lineIdx++) {
      const line = parsedLines[lineIdx];

      for (const [pKey, pData] of periodMap.entries()) {
        const colIdx = pData.colIndex;
        const val = line.values.get(colIdx);

        // For group headers without values, still insert with value 0 to preserve structure
        const finalValue = val ?? 0;

        // Skip non-group lines with no value for this period
        if (!line.isGroup && val === undefined) continue;

        const cellRef = `${dreTab}!${colToLetter(colIdx)}${line.rowIndex + 1}`;

        lineInserts.push({
          period_id: pData.id,
          user_id: userId,
          group_label: line.groupLabel,
          line_label: line.label,
          value: finalValue,
          source_cell: cellRef,
          source_tab: dreTab,
          order_index: lineIdx,
          is_group: line.isGroup,
          is_subtotal: line.isSubtotal,
        });
      }
    }

    // Insert in batches of 500
    const BATCH_SIZE = 500;
    let totalInserted = 0;
    for (let i = 0; i < lineInserts.length; i += BATCH_SIZE) {
      const batch = lineInserts.slice(i, i + BATCH_SIZE);
      const { error: lineError } = await supabase.from("dre_lines").insert(batch);
      if (lineError) throw new Error(`Failed to insert lines batch: ${lineError.message}`);
      totalInserted += batch.length;
    }

    // 12. Validation: check consistency for each period
    const validationUpdates: Array<{ periodId: string; status: string; notes: string[] }> = [];

    for (const [pKey, pData] of periodMap.entries()) {
      const periodLines = lineInserts.filter(l => l.period_id === pData.id && !l.is_group);
      const notes: string[] = [];

      // Find subtotals and group items
      const getGroupItems = (groupNorm: string) =>
        periodLines.filter(l => l.group_label && normalize(l.group_label).includes(groupNorm) && !l.is_subtotal && !l.is_group);

      const getSubtotal = (keyword: string) =>
        periodLines.find(l => l.is_subtotal && normalize(l.line_label).includes(keyword));

      // Check: RECEITA LIQUIDA ~= items in FATURAMENTO + items in DEDUCOES
      const faturamentoItems = getGroupItems("faturamento");
      const deducoesItems = getGroupItems("deducoe");
      const recLiqSubtotal = getSubtotal("receita liquida");

      if (faturamentoItems.length > 0 && recLiqSubtotal) {
        const sumFat = faturamentoItems.reduce((s, l) => s + l.value, 0);
        const sumDed = deducoesItems.reduce((s, l) => s + l.value, 0);
        const expected = sumFat + sumDed;
        if (Math.abs(recLiqSubtotal.value - expected) > 0.01) {
          notes.push(`Receita Líquida diverge: planilha=${recLiqSubtotal.value}, calculado=${expected.toFixed(2)}`);
        }
      }

      // Check: DESPESAS TOTAIS ~= sum of items in DESPESAS
      const despesasItems = getGroupItems("despesa");
      const despTotalSubtotal = getSubtotal("despesas totais") || getSubtotal("total despesas");

      if (despesasItems.length > 0 && despTotalSubtotal) {
        const sumDesp = despesasItems.reduce((s, l) => s + l.value, 0);
        if (Math.abs(despTotalSubtotal.value - sumDesp) > 0.01) {
          notes.push(`Despesas Totais diverge: planilha=${despTotalSubtotal.value}, calculado=${sumDesp.toFixed(2)}`);
        }
      }

      if (notes.length > 0) {
        validationUpdates.push({ periodId: pData.id, status: "warning", notes });
      }
    }

    for (const vu of validationUpdates) {
      await supabase.from("dre_periods").update({
        validation_status: vu.status,
        validation_notes: vu.notes,
      }).eq("id", vu.periodId);
    }

    console.log(`Import complete: ${periodColumns.length} periods, ${totalInserted} lines`);

    return new Response(JSON.stringify({
      success: true,
      found: true,
      tab_name: dreTab,
      periods_count: periodColumns.length,
      lines_count: totalInserted,
      periods: periodColumns.map(p => p.periodKey),
      warnings: validationUpdates.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("DRE sync error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
