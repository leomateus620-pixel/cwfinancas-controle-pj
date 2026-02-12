import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// ========== TYPES ==========

interface DRESyncRequest {
  connection_id: string;
}

interface DRELineMapping {
  row_index: number;
  label: string;
  keywords_matched: string[];
}

type LineKey =
  | "REVENUE_GROSS" | "TAXES" | "REVENUE_NET" | "COGS" | "GROSS_PROFIT"
  | "OPEX_TOTAL" | "OPEX_ADMIN" | "OPEX_SALES" | "OPEX_PAYROLL" | "OPEX_FINANCE" | "OPEX_OTHER"
  | "EBITDA" | "OPERATING_INCOME" | "FIN_RESULT" | "PRE_TAX_INCOME" | "IR_CSLL" | "NET_INCOME";

// ========== KEYWORD MAPPINGS ==========

const LINE_KEY_KEYWORDS: Record<LineKey, string[]> = {
  REVENUE_GROSS: ["receita bruta", "faturamento", "receitas", "receita operacional bruta", "receita total", "revenue", "gross revenue"],
  TAXES: ["impostos", "deducoes", "deduções", "iss", "icms", "pis", "cofins", "taxas sobre receita", "deducao", "deduçao", "impostos sobre receita", "tributos"],
  REVENUE_NET: ["receita liquida", "receita líquida", "net revenue"],
  COGS: ["custo", "cmv", "csp", "custo dos servicos", "custo dos serviços", "custo mercadoria", "cpv", "custo produto", "custo servico", "cogs"],
  GROSS_PROFIT: ["lucro bruto", "resultado bruto", "gross profit"],
  OPEX_ADMIN: ["administrativa", "administracao", "administração", "adm", "despesas administrativas", "despesa administrativa"],
  OPEX_SALES: ["comercial", "marketing", "vendas", "trafego", "tráfego", "despesas comerciais", "despesa comercial", "publicidade"],
  OPEX_PAYROLL: ["salario", "salário", "pessoal", "folha", "pro-labore", "pro labore", "prolabore", "pró-labore", "encargos", "remuneracao", "remuneração"],
  OPEX_FINANCE: ["financeiro", "juros", "tarifas", "taxa bancaria", "taxa bancária", "despesas financeiras", "despesa financeira", "iof", "tarifa bancaria"],
  OPEX_OTHER: ["outras", "diversas", "outras despesas", "outros", "demais despesas"],
  OPEX_TOTAL: ["total despesas", "despesas operacionais", "total opex", "despesas totais", "total desp"],
  EBITDA: ["ebitda", "lajida"],
  OPERATING_INCOME: ["resultado operacional", "lucro operacional", "operating income"],
  FIN_RESULT: ["resultado financeiro", "financial result", "receitas financeiras", "receita financeira"],
  PRE_TAX_INCOME: ["resultado antes", "lair", "lucro antes", "pre tax"],
  IR_CSLL: ["ir", "csll", "imposto de renda", "contribuicao social", "contribuição social", "ir/csll", "irpj"],
  NET_INCOME: ["resultado liquido", "resultado líquido", "lucro liquido", "lucro líquido", "net income"],
};

// Subtotal keys (recalculated internally)
const SUBTOTAL_KEYS: LineKey[] = ["REVENUE_NET", "GROSS_PROFIT", "OPEX_TOTAL", "EBITDA", "OPERATING_INCOME", "NET_INCOME"];

// Month name detection for format detection
const MONTH_PATTERNS = [
  /^jan/i, /^fev/i, /^mar/i, /^abr/i, /^mai/i, /^jun/i,
  /^jul/i, /^ago/i, /^set/i, /^out/i, /^nov/i, /^dez/i,
  /^january/i, /^february/i, /^march/i, /^april/i, /^may/i, /^june/i,
  /^july/i, /^august/i, /^september/i, /^october/i, /^november/i, /^december/i,
];

const MONTH_TO_NUM: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

// ========== HELPERS ==========

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function parseBRL(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  let str = String(value).trim();
  if (!str) return null;
  // Reject dates
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

function detectDRETab(sheetTitles: string[]): string | null {
  const dreKeywords = ["dre", "demonstracao", "demonstração", "resultado"];
  for (const title of sheetTitles) {
    const norm = normalize(title);
    if (dreKeywords.some(k => norm.includes(k))) return title;
  }
  return null;
}

function isMonthHeader(val: string): boolean {
  const norm = normalize(val);
  return MONTH_PATTERNS.some(p => p.test(norm));
}

function extractPeriodKey(header: string): string {
  const norm = normalize(header);
  // "jan/2026" or "jan 2026" or "janeiro 2026"
  const match = norm.match(/([a-z]+)[\s\/\-]*(\d{4})/);
  if (match) {
    const monthKey = Object.keys(MONTH_TO_NUM).find(m => norm.startsWith(m));
    if (monthKey) return `${match[2]}-${MONTH_TO_NUM[monthKey]}`;
  }
  // "jan/26"
  const match2 = norm.match(/([a-z]+)[\s\/\-]*(\d{2})$/);
  if (match2) {
    const monthKey = Object.keys(MONTH_TO_NUM).find(m => norm.startsWith(m));
    if (monthKey) {
      const year = parseInt(match2[2]) > 50 ? `19${match2[2]}` : `20${match2[2]}`;
      return `${year}-${MONTH_TO_NUM[monthKey]}`;
    }
  }
  // Fallback: use the header text cleaned
  return norm.replace(/\s+/g, "_");
}

function matchLineKey(label: string): { key: LineKey; keywords: string[] } | null {
  const norm = normalize(label);
  for (const [key, keywords] of Object.entries(LINE_KEY_KEYWORDS)) {
    const matched = keywords.filter(k => {
      const kNorm = normalize(k);
      return norm.includes(kNorm) || norm === kNorm;
    });
    if (matched.length > 0) return { key: key as LineKey, keywords: matched };
  }
  return null;
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

// ========== MAIN ==========

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = userData.user.id;
    const body: DRESyncRequest = await req.json();
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

    // 3. Get spreadsheet metadata (list of tabs)
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!metaRes.ok) throw new Error("Failed to fetch spreadsheet metadata");
    const meta = await metaRes.json();
    const sheetTitles: string[] = meta.sheets.map((s: { properties: { title: string } }) => s.properties.title);

    // 4. Auto-detect DRE tab
    const dreTab = detectDRETab(sheetTitles);
    if (!dreTab) {
      return new Response(JSON.stringify({
        success: false,
        found: false,
        message: "Aba DRE não encontrada na planilha. Crie uma aba chamada 'DRE' com os dados do demonstrativo.",
        available_tabs: sheetTitles,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. Read entire DRE tab
    const range = encodeURIComponent(`'${dreTab}'!A1:Z200`);
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}/values/${range}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!dataRes.ok) throw new Error("Failed to read DRE tab");
    const sheetData = await dataRes.json();
    const rows: string[][] = sheetData.values || [];

    if (rows.length < 2) {
      return new Response(JSON.stringify({
        success: false,
        found: true,
        message: "Aba DRE encontrada mas está vazia ou com dados insuficientes.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 6. Detect format
    const headerRow = rows[0];
    const nonLabelHeaders = headerRow.slice(1).filter(h => h && h.trim());
    const monthColumns = nonLabelHeaders.filter(h => isMonthHeader(h));
    const isColumnsByMonth = monthColumns.length >= 1;
    const formatDetected = isColumnsByMonth ? "columns_by_month" : "block_summary";

    console.log(`Format detected: ${formatDetected}, month columns: ${monthColumns.length}`);

    // 7. Map rows to line keys
    const rowMappings: Map<number, { key: LineKey; label: string; keywords: string[] }> = new Map();
    for (let i = 0; i < rows.length; i++) {
      const label = rows[i][0];
      if (!label || !label.trim()) continue;
      const match = matchLineKey(label);
      if (match) {
        // Don't overwrite if already mapped (first match wins)
        const alreadyMapped = Array.from(rowMappings.values()).some(m => m.key === match.key);
        if (!alreadyMapped) {
          rowMappings.set(i, { key: match.key, label: label.trim(), keywords: match.keywords });
        }
      }
    }

    console.log(`Mapped ${rowMappings.size} DRE lines`);

    // 8. Build header signature for cache
    const headerSignature = headerRow.join("|").substring(0, 200);

    // 9. Extract values per period
    const dreRecords: Array<{
      period_key: string;
      line_key: LineKey;
      value: number;
      source_tab: string;
      source_cell: string;
      source_label: string;
      is_calculated: boolean;
      original_value: number | null;
    }> = [];

    if (isColumnsByMonth) {
      // Format 1: columns by month
      for (let colIdx = 1; colIdx < headerRow.length; colIdx++) {
        const colHeader = headerRow[colIdx];
        if (!colHeader || !colHeader.trim()) continue;
        if (!isMonthHeader(colHeader)) continue;
        
        const periodKey = extractPeriodKey(colHeader);
        const periodValues: Partial<Record<LineKey, number>> = {};
        const periodOriginals: Partial<Record<LineKey, number | null>> = {};

        // Extract base values
        for (const [rowIdx, mapping] of rowMappings.entries()) {
          const cellValue = rows[rowIdx]?.[colIdx];
          const parsed = parseBRL(cellValue);
          if (parsed !== null) {
            periodValues[mapping.key] = parsed;
            const cellRef = `${dreTab}!${colToLetter(colIdx)}${rowIdx + 1}`;
            dreRecords.push({
              period_key: periodKey,
              line_key: mapping.key,
              value: parsed,
              source_tab: dreTab,
              source_cell: cellRef,
              source_label: mapping.label,
              is_calculated: false,
              original_value: null,
            });
          }
        }

        // Recalculate subtotals
        addCalculatedSubtotals(periodValues, periodOriginals, dreRecords, periodKey, dreTab);
      }
    } else {
      // Format 2: block summary (column A = label, column B = value)
      const periodKey = "summary";
      const periodValues: Partial<Record<LineKey, number>> = {};
      const periodOriginals: Partial<Record<LineKey, number | null>> = {};

      for (const [rowIdx, mapping] of rowMappings.entries()) {
        const cellValue = rows[rowIdx]?.[1];
        const parsed = parseBRL(cellValue);
        if (parsed !== null) {
          periodValues[mapping.key] = parsed;
          const cellRef = `${dreTab}!B${rowIdx + 1}`;
          dreRecords.push({
            period_key: periodKey,
            line_key: mapping.key,
            value: parsed,
            source_tab: dreTab,
            source_cell: cellRef,
            source_label: mapping.label,
            is_calculated: false,
            original_value: null,
          });
        }
      }

      addCalculatedSubtotals(periodValues, periodOriginals, dreRecords, periodKey, dreTab);
    }

    // 10. UPSERT dre_values
    if (dreRecords.length > 0) {
      const upsertData = dreRecords.map(r => ({
        user_id: userId,
        sheet_id: connection_id,
        period_key: r.period_key,
        line_key: r.line_key,
        value: r.value,
        source_tab: r.source_tab,
        source_cell: r.source_cell,
        source_label: r.source_label,
        is_calculated: r.is_calculated,
        original_value: r.original_value,
      }));

      const { error: upsertError } = await supabase
        .from("dre_values")
        .upsert(upsertData, { onConflict: "user_id,sheet_id,period_key,line_key" });

      if (upsertError) {
        console.error("UPSERT error:", upsertError);
        throw new Error(`Failed to save DRE values: ${upsertError.message}`);
      }
    }

    // 11. Save mapping cache
    const mappingData: Record<string, DRELineMapping> = {};
    for (const [rowIdx, mapping] of rowMappings.entries()) {
      mappingData[mapping.key] = {
        row_index: rowIdx,
        label: mapping.label,
        keywords_matched: mapping.keywords,
      };
    }

    await supabase.from("dre_mappings").upsert({
      user_id: userId,
      sheet_id: connection_id,
      tab_name: dreTab,
      header_signature: headerSignature,
      mapping: mappingData,
      format_detected: formatDetected,
      confidence: rowMappings.size / Object.keys(LINE_KEY_KEYWORDS).length,
    }, { onConflict: "user_id,sheet_id,header_signature" });

    // 12. Return result
    const periods = [...new Set(dreRecords.map(r => r.period_key))];
    return new Response(JSON.stringify({
      success: true,
      found: true,
      tab_name: dreTab,
      format: formatDetected,
      periods,
      lines_mapped: rowMappings.size,
      values_saved: dreRecords.length,
      mapping: mappingData,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("DRE sync error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ========== SUBTOTAL CALCULATION ==========

function addCalculatedSubtotals(
  periodValues: Partial<Record<LineKey, number>>,
  periodOriginals: Partial<Record<LineKey, number | null>>,
  dreRecords: Array<{
    period_key: string; line_key: LineKey; value: number;
    source_tab: string; source_cell: string; source_label: string;
    is_calculated: boolean; original_value: number | null;
  }>,
  periodKey: string,
  dreTab: string,
) {
  const v = (key: LineKey) => periodValues[key] ?? 0;

  const calculations: Array<{ key: LineKey; calc: () => number; label: string }> = [
    { key: "REVENUE_NET", calc: () => v("REVENUE_GROSS") - Math.abs(v("TAXES")), label: "Receita Líquida (calculado)" },
    { key: "GROSS_PROFIT", calc: () => {
      const revNet = periodValues["REVENUE_NET"] ?? (v("REVENUE_GROSS") - Math.abs(v("TAXES")));
      return revNet - Math.abs(v("COGS"));
    }, label: "Lucro Bruto (calculado)" },
    { key: "OPEX_TOTAL", calc: () => -(Math.abs(v("OPEX_ADMIN")) + Math.abs(v("OPEX_SALES")) + Math.abs(v("OPEX_PAYROLL")) + Math.abs(v("OPEX_FINANCE")) + Math.abs(v("OPEX_OTHER"))), label: "Total Despesas Operacionais (calculado)" },
    { key: "EBITDA", calc: () => {
      const gp = periodValues["GROSS_PROFIT"] ?? (
        (periodValues["REVENUE_NET"] ?? (v("REVENUE_GROSS") - Math.abs(v("TAXES")))) - Math.abs(v("COGS"))
      );
      const opex = Math.abs(v("OPEX_ADMIN")) + Math.abs(v("OPEX_SALES")) + Math.abs(v("OPEX_PAYROLL")) + Math.abs(v("OPEX_FINANCE")) + Math.abs(v("OPEX_OTHER"));
      return gp - opex;
    }, label: "EBITDA (calculado)" },
    { key: "OPERATING_INCOME", calc: () => {
      return periodValues["EBITDA"] ?? v("EBITDA");
    }, label: "Resultado Operacional (calculado)" },
    { key: "NET_INCOME", calc: () => {
      const opInc = periodValues["OPERATING_INCOME"] ?? periodValues["EBITDA"] ?? v("EBITDA");
      return opInc + v("FIN_RESULT") - Math.abs(v("IR_CSLL"));
    }, label: "Resultado Líquido (calculado)" },
  ];

  for (const { key, calc, label } of calculations) {
    const calculated = calc();
    const existing = periodValues[key];
    // Only add if not already present as a direct read, or if present, validate
    const existingRecord = dreRecords.find(r => r.period_key === periodKey && r.line_key === key && !r.is_calculated);

    if (existingRecord) {
      // Compare with calculation
      const tolerance = Math.max(Math.abs(calculated) * 0.01, 1); // 1% or R$1
      if (Math.abs(existingRecord.value - calculated) > tolerance) {
        // Mark as recalculated, store original
        existingRecord.is_calculated = true;
        existingRecord.original_value = existingRecord.value;
        existingRecord.value = calculated;
        existingRecord.source_label += " [recalculado]";
      }
      periodValues[key] = existingRecord.value;
    } else {
      // Add calculated value
      periodValues[key] = calculated;
      dreRecords.push({
        period_key: periodKey,
        line_key: key,
        value: calculated,
        source_tab: dreTab,
        source_cell: "calculado",
        source_label: label,
        is_calculated: true,
        original_value: null,
      });
    }
  }
}
