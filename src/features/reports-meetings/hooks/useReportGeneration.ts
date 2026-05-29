import { useMutation, useQueryClient } from "@tanstack/react-query";

import { financeGr2026WorkbookFixture } from "../test-fixtures/financeGr2026Fixture";
import { buildPreMeetingReportFromWorkbook, type ReportsMeetingsPackage } from "../lib/financialWorkbook";
import { previewToWorkbookSnapshot, readSheetSource } from "../lib/sourceAdapters";
import type { MeetingSource } from "./useMeetingSources";

interface GenerateReportInput {
  sources?: MeetingSource[];
  forceFixture?: boolean;
}

function appendAudit(pkg: ReportsMeetingsPackage, extra: string[], mode: ReportsMeetingsPackage["mode"] = pkg.mode) {
  return {
    ...pkg,
    mode,
    auditLog: [...extra, ...pkg.auditLog],
    analysis: {
      ...pkg.analysis,
      auditLog: [...extra, ...pkg.analysis.auditLog],
    },
    report: {
      ...pkg.report,
      report_json: {
        ...pkg.report.report_json,
        auditLog: [...extra, ...((pkg.report.report_json.auditLog as string[] | undefined) ?? [])],
      },
    },
  };
}

export function useReportGeneration() {
  const qc = useQueryClient();
  return useMutation<ReportsMeetingsPackage, Error, GenerateReportInput | undefined>({
    mutationFn: async (payload) => {
      const sources = payload?.sources ?? [];
      const audit: string[] = [];

      if (payload?.forceFixture || import.meta.env.VITE_REPORTS_MEETINGS_E2E === "1") {
        return appendAudit(buildPreMeetingReportFromWorkbook(financeGr2026WorkbookFixture), [
          "Modo fixture ativado explicitamente para teste E2E.",
        ]);
      }

      for (const source of sources) {
        try {
          const raw = await readSheetSource(source.spreadsheet_id, {
            sheetNames: source.selected_tabs,
            mode: "full",
            purpose: "meetings",
          });
          const rawRecord = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
          const workbookPayload = rawRecord.workbook as
            | { sourceName?: string; provider?: string; sheets?: { name: string; rows: unknown[][] }[] }
            | undefined;
          const providerLabel =
            source.provider === "drive_xlsx"
              ? "Excel .xlsx no Drive"
              : source.provider === "excel_upload"
                ? "Upload Excel"
                : "Google Sheets nativo";
          audit.push(`Fonte lida: ${source.spreadsheet_name} (${providerLabel}).`);
          const workbook = previewToWorkbookSnapshot(
            workbookPayload
              ? { sheets: workbookPayload.sheets, spreadsheet_name: workbookPayload.sourceName ?? source.spreadsheet_name }
              : raw,
            source,
          );
          return appendAudit(buildPreMeetingReportFromWorkbook(workbook), audit);
        } catch (error) {
          audit.push(
            `Falha ao ler fonte ${source.spreadsheet_name}; tentando próxima (${error instanceof Error ? error.message : "erro desconhecido"}).`,
          );
        }
      }

      return appendAudit(buildPreMeetingReportFromWorkbook(financeGr2026WorkbookFixture), [
        ...audit,
        "Nenhuma fonte real pôde ser lida; fixture Financeiro GR - 2026 usada como fallback (não grava na planilha).",
      ], "fallback");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre-meeting-reports"] }),
  });
}
