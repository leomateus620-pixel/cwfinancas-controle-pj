import { describe, expect, it } from "vitest";
import { financeGr2026WorkbookFixture } from "../../test-fixtures/financeGr2026Fixture";
import { buildPreMeetingReportFromWorkbook } from "../financialWorkbook";
import { buildConsolidatedMeetingReport } from "../meetingComparison";
import { buildFinalTranscript, buildTopicSummary, cleanTranscriptSegments, detectMeetingInstability } from "../meetingRecorderUtils";

describe("reports meetings recurring flow e2e", () => {
  it("Google Sheets fixture -> pre-report -> XLSX update -> transcript -> summary -> final comparison", () => {
    const pkg = buildPreMeetingReportFromWorkbook(financeGr2026WorkbookFixture, {
      currentDate: new Date("2026-05-30T12:00:00-03:00"),
    });
    expect(pkg.analysis.latestSheetName).toBe("Mai2026");
    expect(pkg.dreUpdate.fileName).toBe("Financeiro GR - 2026 1-atualizado-2026-05.xlsx");
    expect(pkg.dreUpdate.mode).toBe("source_xlsx_edit");

    const messyTranscript = cleanTranscriptSegments([
      "Ana: vamos revisar receita de maio e confirmar despesas",
      "vamos revisar receita de maio e confirmar despesas",
      "Cliente: pediu XLSX atualizado ate sexta",
      "Joao: ficou decidido revisar RPAs e validar Simples Nacional em 10/06",
      "falha temporaria no audio audio",
    ]);
    const finalTranscript = buildFinalTranscript(messyTranscript, "", "Responsavel Ana vai enviar pendencias.");
    const instability = detectMeetingInstability({ recognitionUnstable: true, autosaveError: true });
    const topicSummary = buildTopicSummary(finalTranscript, instability.events);
    const comparison = buildConsolidatedMeetingReport({
      preMeetingReport: pkg.report,
      topicSummary,
      transcriptText: finalTranscript,
    });

    expect(topicSummary.clientRequests.join(" ")).toContain("XLSX atualizado");
    expect(topicSummary.validationItems.length).toBeGreaterThan(0);
    expect(topicSummary.operationalStatus).toBe("attention");
    expect(comparison.financialSummary).toContain("resultado");
    expect(comparison.nextSteps.length).toBeGreaterThan(0);
  });
});
