import { supabase } from "@/integrations/supabase/client";
import type { MeetingSource } from "./reportsMeetingTypes";
import {
  buildMonthlySummaries,
  detectLatestMonthlySheet,
  extractTransactionsFromSheet,
  normalizeFinancialDataFromWorkbook,
  parseCurrencyValue,
  type SheetCell,
  type WorkbookSnapshot,
} from "./financialWorkbook";

interface GoogleConnectionRow {
  id: string;
  spreadsheet_id: string;
  spreadsheet_name: string;
  data_type: string;
  sheet_name: string | null;
}

type UnknownRecord = Record<string, unknown>;

export async function listAvailableSheetSources(): Promise<MeetingSource[]> {
  const { data, error } = await supabase
    .from("google_sheet_connections")
    .select("id, spreadsheet_id, spreadsheet_name, data_type, sheet_name");
  if (error) throw error;
  return ((data ?? []) as GoogleConnectionRow[]).map((row) => ({
    id: row.id,
    source_type: "google_sheets",
    external_id: row.spreadsheet_id,
    external_name: row.spreadsheet_name,
    metadata: { data_type: row.data_type, sheet_name: row.sheet_name },
  }));
}

export async function readSheetSource(sourceId: string, options?: { sheetNames?: string[]; mode?: "preview" | "full"; purpose?: string }) {
  const { data, error } = await supabase.functions.invoke("google-read-sheet-preview", {
    body: {
      spreadsheetId: sourceId,
      sheetNames: options?.sheetNames,
      mode: options?.mode ?? "preview",
    },
  });
  if (error) throw error;
  return data as unknown;
}

export async function readDocSource(_sourceId: string, options?: { manualText?: string }) {
  if (options?.manualText) return { provider: "manual", text: options.manualText };
  return { provider: "lovable_docs_connector", status: "not_linked", message: "Conector Docs pronto para vincular pelo Lovable" };
}

export function normalizeFinancialData(rawData: unknown) {
  const raw = asRecord(rawData);
  const workbook = previewToWorkbookSnapshot(raw, {
    spreadsheet_name: getString(raw.spreadsheet_name) ?? getString(raw.name) ?? "Fonte conectada",
    spreadsheet_id: getString(raw.spreadsheet_id) ?? getString(raw.id) ?? "preview",
    selected_tabs: getStringArray(raw.selected_tabs),
    provider: (getString(raw.provider) as WorkbookSnapshot["provider"]) ?? "google_sheets",
  });
  try {
    const analysis = normalizeFinancialDataFromWorkbook(workbook);
    return {
      revenue: analysis.revenue,
      expenses: analysis.expenses,
      cash: analysis.cash,
      monthlySeries: analysis.monthlySeries.map((m) => m.result),
      latestSheetName: analysis.latestSheetName,
      rawData,
    };
  } catch {
    const values = getRows(asRecord(raw.preview).values ?? raw.values);
    const flattened = values.flat().map((v) => String(v).trim());
    const numbers = flattened.map(parseCurrencyValue).filter((n): n is number => Number.isFinite(n));
    const positives = numbers.filter((n) => n > 0);
    const negatives = numbers.filter((n) => n < 0).map(Math.abs);
    return {
      revenue: positives[0] ?? numbers[0] ?? null,
      expenses: negatives[0] ?? numbers[1] ?? null,
      cash: numbers[2] ?? null,
      monthlySeries: numbers.slice(0, 12),
      rawData,
    };
  }
}

export function previewToWorkbookSnapshot(
  rawData: unknown,
  source: {
    spreadsheet_id?: string | null;
    spreadsheet_name?: string | null;
    selected_tabs?: string[];
    provider?: WorkbookSnapshot["provider"];
  },
): WorkbookSnapshot {
  const raw = asRecord(rawData);
  const sheets: { name: string; rows: SheetCell[][] }[] = [];
  const selectedTabs = source.selected_tabs?.length ? source.selected_tabs : undefined;

  if (Array.isArray(raw.sheets)) {
    for (const sheet of raw.sheets) {
      const item = asRecord(sheet);
      sheets.push({
        name: getString(item.title) ?? getString(item.name) ?? `Aba ${sheets.length + 1}`,
        rows: getRows(item.values ?? item.rows),
      });
    }
  } else if (raw.sheets && typeof raw.sheets === "object") {
    for (const [name, values] of Object.entries(raw.sheets as UnknownRecord)) {
      sheets.push({ name, rows: getRows(values) });
    }
  } else if (Array.isArray(raw.tabs)) {
    for (const tab of raw.tabs) {
      const item = asRecord(tab);
      sheets.push({
        name: getString(item.title) ?? getString(item.name) ?? `Aba ${sheets.length + 1}`,
        rows: getRows(item.values ?? item.rows),
      });
    }
  } else {
    const preview = asRecord(raw.preview);
    const values = preview.values ?? raw.values ?? raw.rows;
    sheets.push({
      name: selectedTabs?.[0] ?? getString(raw.sheet_name) ?? getString(raw.sheetName) ?? "Preview",
      rows: getRows(values),
    });
  }

  const filtered = selectedTabs
    ? sheets.filter((sheet) => selectedTabs.includes(sheet.name) || sheets.length === 1)
    : sheets;

  return {
    sourceName: source.spreadsheet_name ?? source.spreadsheet_id ?? "Google Sheets",
    provider: source.provider ?? "google_sheets",
    fetchedAt: new Date().toISOString(),
    audit: [`Leitura de planilha recebida via contrato de preview (${filtered.length} aba${filtered.length === 1 ? "" : "s"}).`],
    sheets: filtered.length ? filtered : sheets,
  };
}

export function extractMeetingContextFromDocs(rawDocs: unknown) {
  const text = String(asRecord(rawDocs).text ?? "").replace(/[<>]/g, "").trim();
  return { sanitizedText: text, hasContent: text.length > 0 };
}

export function getWorkbookContractDiagnostics(workbook: WorkbookSnapshot) {
  try {
    const latest = detectLatestMonthlySheet(workbook);
    const transactions = extractTransactionsFromSheet(latest);
    const series = buildMonthlySummaries(workbook);
    return {
      ok: true,
      latestSheetName: latest.name,
      transactionCount: transactions.length,
      monthlyTabs: series.map((item) => item.sheetName),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao validar contrato de planilha.",
      latestSheetName: null,
      transactionCount: 0,
      monthlyTabs: [],
    };
  }
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

function getRows(values: unknown): SheetCell[][] {
  if (!Array.isArray(values)) return [];
  return values.map((row) => (Array.isArray(row) ? row : [row])) as SheetCell[][];
}
