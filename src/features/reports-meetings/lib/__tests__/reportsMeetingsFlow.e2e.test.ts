import { describe, expect, it } from "vitest";
import { financeGr2026WorkbookFixture } from "../../test-fixtures/financeGr2026Fixture";
import { buildPreMeetingReportFromWorkbook } from "../financialWorkbook";
import { buildConsolidatedMeetingReport } from "../meetingComparison";
import { buildFinalTranscript, buildTopicSummary, cleanTranscriptSegments, detectMeetingInstability } from "../meetingRecorderUtils";

describe("reports meetings recurring flow e2e", () => {
  it("Google Sheets fixture -> pre-report -> DRE offline -> transcript -> summary -> final comparison", () => {
    const pkg = buildPreMeetingReportFromWorkbook(financeGr2026WorkbookFixture);
    expect(pkg.analysis.latestSheetName).toBe("Mai2026");
    expect(pkg.offlineDre.fileName).toBe("dre-offline-2026-05.xlsx");

    const messyTranscript = cleanTranscriptSegments([
      "Ana: vamos revisar receita de maio e confirmar despesas",
      "vamos revisar receita de maio e confirmar despesas",
      "Cliente: pediu DRE offline ate sexta",
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

    expect(topicSummary.clientRequests.join(" ")).toContain("DRE offline");
    expect(topicSummary.validationItems.length).toBeGreaterThan(0);
    expect(topicSummary.operationalStatus).toBe("attention");
    expect(comparison.financialSummary).toContain("resultado");
    expect(comparison.nextSteps.length).toBeGreaterThan(0);
  });
});
