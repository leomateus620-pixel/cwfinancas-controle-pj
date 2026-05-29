import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

      try {
        const { data, error } = await supabase.functions.invoke("reports-meetings-generate", {
          body: {
            source_ids: sources.map((source) => source.id),
            spreadsheet_ids: sources.map((source) => source.spreadsheet_id),
            selected_tabs: sources.flatMap((source) => source.selected_tabs),
            dry_run: true,
          },
        });
        if (error) throw error;
        if (data?.workbook) {
          return appendAudit(buildPreMeetingReportFromWorkbook(data.workbook), [
            "Relatorio recebido da Edge Function reports-meetings-generate.",
          ]);
        }
        audit.push("Edge Function respondeu sem workbook processavel; usando leitura local segura.");
      } catch (error) {
        audit.push(
          `Edge Function indisponivel temporariamente; fallback local acionado (${error instanceof Error ? error.message : "erro desconhecido"}).`,
        );
      }

      for (const source of sources) {
        try {
          const raw = await readSheetSource(source.spreadsheet_id, {
            sheetNames: source.selected_tabs,
            purpose: "meetings",
          });
          const workbook = previewToWorkbookSnapshot(raw, source);
          return appendAudit(buildPreMeetingReportFromWorkbook(workbook), audit);
        } catch (error) {
          audit.push(
            `Falha ao ler fonte ${source.spreadsheet_name}; mantendo fallback (${error instanceof Error ? error.message : "erro desconhecido"}).`,
          );
        }
      }

      return appendAudit(buildPreMeetingReportFromWorkbook(financeGr2026WorkbookFixture), [
        ...audit,
        "Nenhuma fonte real pode ser lida neste ambiente; fixture Financeiro GR - 2026 usada sem gravar na planilha conectada.",
      ], "fallback");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre-meeting-reports"] }),
  });
}
