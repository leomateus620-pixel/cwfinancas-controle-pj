import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createHash } from "https://deno.land/std@0.177.0/node/crypto.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const INTERNAL_TIMEOUT_MS = 110_000;
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

function inferYearFromFileName(name: string): number | null {
  const match = name.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

// ============ Utility functions ============

function generateRowHash(content: Record<string, unknown>): string {
  const hash = createHash("md5");
  hash.update(JSON.stringify(content));
  return hash.digest("hex").slice(0, 12);
}

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ============ Parsers (same as sheets-sync-all-tabs) ============

function parseBRL(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  if (value instanceof Date) return null; // Date objects are not amounts
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
  if (value instanceof Date) return true;
  const str = String(value).trim();
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return true;
  if (/^\d{1,2}[\/\-][a-zA-Záéíóúâêîôûãõ]+[\/\-]\d{2,4}$/i.test(str)) return true;
  return false;
}

function parseDate(value: string | number | Date | null | undefined): string | null {
  if (!value) return null;

  // Handle Date objects (from cellDates: true)
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().split("T")[0];
  }

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

// ============ Mapping & Extraction ============

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
    ["account", ["conta", "banco", "account", "bank"]],
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
        mapping[field] = String(headers[i] ?? "").trim() || headers[i];
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

function isSkippableRow(rowObj: Record<string, unknown>, description: string, hasValidDate: boolean): { skip: boolean; reason?: string } {
  const descLower = (description || "").toLowerCase().trim();
  const allValues = Object.values(rowObj).map(v => String(v || "").toLowerCase().trim());
  const headerKeywords = ["data", "date", "valor", "value", "descrição", "descricao", "description", "categoria", "category"];
  const headerMatchCount = headerKeywords.filter(k => allValues.some(v => v === k || v.includes(k))).length;
  if (headerMatchCount >= 2) return { skip: true, reason: "header_row" };
  if (!hasValidDate) {
    const totalKeywords = ["total", "subtotal", "saldo", "soma", "acumulado", "resumo", "balanço", "balanco", "sum", "balance"];
    if (totalKeywords.some(k => descLower.includes(k))) return { skip: true, reason: "total_row" };
  }
  return { skip: false };
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

// ============ Main Handler ============

interface ParseExcelRequest {
  file_path: string;
  file_id: string;  // uploaded_files.id
  file_name: string;
  mode: "preview" | "import";
  selected_tabs?: string[];
  month_range?: { from: string; to: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  console.log(`[${requestId}] parse-excel-upload started`);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body: ParseExcelRequest = await req.json();
    const { file_path, file_id, file_name, mode, selected_tabs, month_range } = body;

    if (!file_path || !file_id || !file_name) {
      return new Response(JSON.stringify({ error: "file_path, file_id and file_name are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] User: ${userId}, Mode: ${mode}, File: ${file_name}`);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("excel-uploads")
      .download(file_path);

    if (downloadError || !fileData) {
      console.error(`[${requestId}] Storage download error:`, downloadError);
      return new Response(JSON.stringify({ error: "Failed to download file from storage" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse Excel with cellDates
    const buffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });

    console.log(`[${requestId}] Parsed workbook: ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(", ")}`);

    // Infer year from file name
    const inferredYear = inferYearFromFileName(file_name);
    const defaultYear = inferredYear || new Date().getFullYear();

    // Classify all tabs
    const classifiedTabs = workbook.SheetNames.map(name => {
      const tab = classifyTab(name, defaultYear);
      const ws = workbook.Sheets[name];
      const rows = ws ? (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as unknown[][]) : [];
      tab.rowCount = rows.length;
      return tab;
    });

    // ==================== PREVIEW MODE ====================
    if (mode === "preview") {
      const tabsPreview = classifiedTabs.map(tab => {
        const ws = workbook.Sheets[tab.title];
        if (!ws) return { ...tab, headers: [], preview_rows: [], mapping: {} };

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as string[][];
        const headers = rows.length > 0 ? rows[0].map(h => String(h || "")) : [];
        const previewRows = rows.slice(1, 11).map(row => row.map(cell => String(cell ?? "")));
        const mapping = autoDetectMapping(headers);

        return {
          title: tab.title,
          route: tab.route,
          monthIndex: tab.monthIndex,
          periodKey: tab.periodKey,
          rowCount: tab.rowCount,
          headers,
          preview_rows: previewRows,
          mapping,
        };
      });

      // Update uploaded_files status
      await supabase.from("uploaded_files").update({
        status: "previewed",
        progress: { tabs_total: classifiedTabs.length, tabs_done: 0, rows_read: 0, rows_imported: 0 },
      }).eq("id", file_id);

      return new Response(JSON.stringify({
        success: true,
        tabs: tabsPreview,
        file_name,
        default_year: defaultYear,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== IMPORT MODE ====================
    // Filter tabs to import
    let monthlyTabs = classifiedTabs.filter(t => t.route === "MONTHLY_TRANSACTIONS");
    const dreTabs = classifiedTabs.filter(t => t.route === "DRE_ONLY");

    if (selected_tabs && selected_tabs.length > 0) {
      const selectedSet = new Set(selected_tabs);
      monthlyTabs = monthlyTabs.filter(t => selectedSet.has(t.title));
    }

    if (month_range) {
      const rangeFromMonth = month_range.from.slice(-2);
      const rangeToMonth = month_range.to.slice(-2);
      monthlyTabs = monthlyTabs.filter(t => {
        if (!t.monthIndex) return false;
        const tabMonth = String(t.monthIndex).padStart(2, "0");
        return tabMonth >= rangeFromMonth && tabMonth <= rangeToMonth;
      });
    }

    monthlyTabs.sort((a, b) => (a.periodKey || "").localeCompare(b.periodKey || ""));
    console.log(`[${requestId}] Importing ${monthlyTabs.length} monthly tabs, ${dreTabs.length} DRE tabs`);

    // Check if any DRE tab was selected
    const importDre = selected_tabs ? dreTabs.some(d => selected_tabs.includes(d.title)) : false;

    // Update status to importing
    await supabase.from("uploaded_files").update({
      status: "importing",
      progress: { tabs_total: monthlyTabs.length + (importDre ? dreTabs.length : 0), tabs_done: 0, rows_read: 0, rows_imported: 0 },
    }).eq("id", file_id);

    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let totalScanned = 0;
    const allWarnings: Array<{ tab: string; row: number; message: string }> = [];
    const tabSummaries: Array<{ tab: string; route: string; imported: number; skipped: number; errors: number }> = [];

    // ===== Process monthly tabs =====
    for (let tabIdx = 0; tabIdx < monthlyTabs.length; tabIdx++) {
      const tab = monthlyTabs[tabIdx];

      if (Date.now() - startTime > INTERNAL_TIMEOUT_MS) {
        console.log(`[${requestId}] TIMEOUT at tab ${tabIdx}/${monthlyTabs.length}`);
        await supabase.from("uploaded_files").update({
          status: "timeout",
          error_message: `Timeout após processar ${tabIdx} de ${monthlyTabs.length} abas`,
          progress: { tabs_total: monthlyTabs.length, tabs_done: tabIdx, rows_read: totalScanned, rows_imported: totalImported },
          warnings: allWarnings.slice(0, 100),
          tab_summary: tabSummaries,
        }).eq("id", file_id);

        return new Response(JSON.stringify({
          success: false, error: "timeout", tabs_imported: tabIdx,
          total_imported: totalImported, total_skipped: totalSkipped, total_errors: totalErrors,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[${requestId}] Processing tab: ${tab.title} [${tabIdx + 1}/${monthlyTabs.length}]`);

      // Update progress
      await supabase.from("uploaded_files").update({
        progress: {
          tabs_total: monthlyTabs.length, tabs_done: tabIdx,
          rows_read: totalScanned, rows_imported: totalImported,
          current_tab: tab.title,
        },
      }).eq("id", file_id);

      const ws = workbook.Sheets[tab.title];
      if (!ws) continue;

      // Read all rows - use raw:false to get formatted strings, but also read with raw:true for numbers
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }) as unknown[][];
      const formattedRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as string[][];

      if (rawRows.length < 2) {
        tabSummaries.push({ tab: tab.title, route: "MONTHLY", imported: 0, skipped: 0, errors: 0 });
        continue;
      }

      const headers = formattedRows[0].map(h => String(h || ""));
      const mapping = autoDetectMapping(headers);
      console.log(`[${requestId}] Tab ${tab.title}: ${rawRows.length - 1} data rows, mapping: ${JSON.stringify(mapping)}`);

      const batch: Array<Record<string, unknown>> = [];
      let tabSkipped = 0;
      let tabErrors = 0;

      for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex++) {
        const rawRow = rawRows[rowIndex];
        const fmtRow = formattedRows[rowIndex] || rawRow;
        const rowNumber = rowIndex + 1;
        totalScanned++;

        try {
          // Build row object using headers - prefer raw values for numbers, formatted for text
          const rowObj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            const rawVal = rawRow[i];
            const fmtVal = fmtRow[i];
            // Use raw value for numeric/date fields, formatted for others
            rowObj[h] = rawVal !== undefined && rawVal !== "" ? rawVal : (fmtVal ?? "");
          });

          // Check if row has content
          const hasContent = rawRow.some(cell => cell !== undefined && cell !== null && cell !== "");
          if (!hasContent) { tabSkipped++; continue; }

          // Extract amount
          const { value: amount, type } = extractAmount(rowObj, mapping);
          if (amount === null || amount === 0) { tabSkipped++; continue; }

          // Parse date
          const dateRaw = mapping.date ? rowObj[mapping.date] : null;
          const date = parseDate(dateRaw as string | number | Date | null);

          // Description
          const description = mapping.description ? String(rowObj[mapping.description] || "").trim() : "";

          // Skip check
          const skipCheck = isSkippableRow(rowObj, description, !!date);
          if (skipCheck.skip) { tabSkipped++; continue; }

          const finalDate = date || (tab.periodKey ? `${tab.periodKey}-01` : new Date().toISOString().split("T")[0]);
          const category = mapping.category ? String(rowObj[mapping.category] || "").trim() || "Geral" : "Geral";
          const clientVendor = mapping.client_vendor ? String(rowObj[mapping.client_vendor] || "").trim() || null : null;
          const account = mapping.account ? String(rowObj[mapping.account] || "").trim() || null : null;

          const rowHash = generateRowHash({ description, amount, date: finalDate, type, category });
          const externalRowKey = `excel:${file_name}:${tab.title}:${rowNumber}:${rowHash}`;
          const movementType = detectMovementType(category, description, type);

          batch.push({
            user_id: userId,
            description: description || "Sem descrição",
            amount: Math.round(amount * 100) / 100,
            date: finalDate,
            type,
            category,
            client_vendor: clientVendor || account,
            notes: `Excel: ${file_name} > ${tab.title}`,
            source: "excel",
            source_tab: tab.title,
            source_row_number: rowNumber,
            external_row_key: externalRowKey,
            raw_data: rowObj,
            movement_type: movementType,
          });
        } catch (err: unknown) {
          tabErrors++;
          const msg = err instanceof Error ? err.message : "Unknown error";
          allWarnings.push({ tab: tab.title, row: rowNumber, message: msg });
        }
      }

      // Batch upsert
      let tabImported = 0;
      for (const chunk of chunks(batch, BATCH_UPSERT_SIZE)) {
        const { error } = await supabase.from("transactions").upsert(chunk, {
          onConflict: "user_id,source_sheet_id,external_row_key",
          ignoreDuplicates: false,
        });

        if (error) {
          // Upsert on user_id + external_row_key (no source_sheet_id for excel)
          // Fallback: insert one by one
          console.warn(`[${requestId}] Batch upsert failed, falling back: ${error.message}`);
          for (const row of chunk) {
            // Try insert, if duplicate key error, try update
            const { error: singleErr } = await supabase.from("transactions").insert(row);
            if (singleErr) {
              if (singleErr.code === "23505") {
                // Duplicate - update instead
                const { error: updateErr } = await supabase.from("transactions")
                  .update(row)
                  .eq("user_id", userId)
                  .eq("external_row_key", row.external_row_key as string);
                if (updateErr) {
                  tabErrors++;
                  allWarnings.push({ tab: tab.title, row: row.source_row_number as number, message: updateErr.message });
                } else {
                  tabImported++;
                }
              } else {
                tabErrors++;
                allWarnings.push({ tab: tab.title, row: row.source_row_number as number, message: singleErr.message });
              }
            } else {
              tabImported++;
            }
          }
        } else {
          tabImported += chunk.length;
        }
      }

      totalImported += tabImported;
      totalSkipped += tabSkipped;
      totalErrors += tabErrors;
      tabSummaries.push({ tab: tab.title, route: "MONTHLY", imported: tabImported, skipped: tabSkipped, errors: tabErrors });

      console.log(`[${requestId}] Tab ${tab.title}: imported=${tabImported}, skipped=${tabSkipped}, errors=${tabErrors}`);
    }

    // ===== DRE tabs (if selected) =====
    if (importDre) {
      for (const dreTab of dreTabs) {
        console.log(`[${requestId}] Processing DRE tab: ${dreTab.title}`);
        // DRE import logic would go here - simplified for now
        tabSummaries.push({ tab: dreTab.title, route: "DRE", imported: 0, skipped: 0, errors: 0 });
      }
    }

    // ===== Finalize =====
    const finalStatus = totalErrors > 0 && totalImported === 0 ? "error" : totalErrors > 0 ? "partial" : "success";

    await supabase.from("uploaded_files").update({
      status: finalStatus,
      rows_imported: totalImported,
      progress: {
        tabs_total: monthlyTabs.length, tabs_done: monthlyTabs.length,
        rows_read: totalScanned, rows_imported: totalImported,
        current_tab: "Concluído",
      },
      warnings: allWarnings.slice(0, 200),
      tab_summary: tabSummaries,
    }).eq("id", file_id);

    console.log(`[${requestId}] DONE: scanned=${totalScanned}, imported=${totalImported}, skipped=${totalSkipped}, errors=${totalErrors}, duration=${Date.now() - startTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      total_scanned: totalScanned,
      total_imported: totalImported,
      total_skipped: totalSkipped,
      total_errors: totalErrors,
      warnings: allWarnings.slice(0, 50),
      tab_summary: tabSummaries,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${requestId}] Fatal error: ${errorMsg}`);

    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
