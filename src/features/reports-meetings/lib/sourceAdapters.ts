import { supabase } from "@/integrations/supabase/client";
import type { MeetingSource } from "./reportsMeetingTypes";

export async function listAvailableSheetSources(): Promise<MeetingSource[]> {
  const { data, error } = await supabase.from("google_sheet_connections").select("id, spreadsheet_id, spreadsheet_name, data_type, sheet_name");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ id: row.id, source_type: "google_sheets", external_id: row.spreadsheet_id, external_name: row.spreadsheet_name, metadata: { data_type: row.data_type, sheet_name: row.sheet_name } }));
}

export async function readSheetSource(sourceId: string, options?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("google-read-sheet-preview", { body: { spreadsheetId: sourceId, ...options } });
  if (error) throw error;
  return data;
}

export async function readDocSource(_sourceId: string, options?: { manualText?: string }) {
  if (options?.manualText) return { provider: "manual", text: options.manualText };
  return { provider: "lovable_docs_connector", status: "not_linked", message: "Conector Docs pronto para vincular pelo Lovable" };
}

export function normalizeFinancialData(rawData: any) {
  const values = rawData?.preview?.values ?? [];
  const flattened = values.flat().map((v: string) => String(v).trim());
  const numbers = flattened.map((v: string) => Number(v.replace(/[^\d,.-]/g, "").replace(",", "."))).filter((n: number) => Number.isFinite(n));
  return {
    revenue: numbers[0] ?? null,
    expenses: numbers[1] ?? null,
    cash: numbers[2] ?? null,
    monthlySeries: numbers.slice(0, 12),
    rawData,
  };
}

export function extractMeetingContextFromDocs(rawDocs: any) {
  const text = String(rawDocs?.text ?? "").replace(/[<>]/g, "").trim();
  return { sanitizedText: text, hasContent: text.length > 0 };
}
