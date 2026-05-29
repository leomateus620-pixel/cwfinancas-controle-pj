import { describe, expect, it } from "vitest";
import { financeGr2026WorkbookFixture } from "../../test-fixtures/financeGr2026Fixture";
import { buildPreMeetingReportFromWorkbook } from "../financialWorkbook";
import { buildConsolidatedMeetingReport } from "../meetingComparison";
import { buildTopicSummary } from "../meetingRecorderUtils";

describe("meeting comparison", () => {
  it("compara relatorio financeiro com a reuniao consolidada", () => {
    const pkg = buildPreMeetingReportFromWorkbook(financeGr2026WorkbookFixture);
    const transcript = [
      "Ficou decidido revisar receitas de maio e validar as despesas de RPAs.",
      "Cliente pediu DRE offline e prazo ate sexta.",
      "A receita mencionada foi 20747 e o resultado precisa ser conferido manualmente.",
    ].join(" ");
    const summary = buildTopicSummary(transcript);
    const comparison = buildConsolidatedMeetingReport({
      preMeetingReport: pkg.report,
      topicSummary: summary,
      transcriptText: transcript,
    });

    expect(comparison.financialSummary).toContain("Mai2026");
    expect(comparison.clientRequests.length).toBeGreaterThan(0);
    expect(comparison.manualValidationItems.length).toBeGreaterThan(0);
    expect(comparison.priorities.length).toBeGreaterThan(0);
  });
});
