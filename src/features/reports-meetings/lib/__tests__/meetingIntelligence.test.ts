import { describe, expect, it } from "vitest";
import { compareReportAndMeeting, detectMentionedNumbers, extractActionsFromTranscript } from "../meetingIntelligence";
import { normalizeFinancialData } from "../sourceAdapters";

describe("reports meetings intelligence", () => {
  it("normalizes sheet data", () => {
    const result = normalizeFinancialData({ preview: { values: [["1200", "500", "700"]] } });
    expect(result.revenue).toBe(1200);
    expect(result.expenses).toBe(500);
  });

  it("extracts topics/actions from transcript", () => {
    const actions = extractActionsFromTranscript("Responsável: Ana deve ajustar orçamento. Revisar contrato amanhã.");
    expect(actions.length).toBeGreaterThan(0);
  });

  it("compares report and meeting", () => {
    const numbers = detectMentionedNumbers("Receita 1000 e despesa 400");
    const cmp = compareReportAndMeeting([{ label: "Receitas", value: 1000 }, { label: "Despesas", value: 400 }], numbers);
    expect(cmp.alignmentScore).toBeGreaterThan(50);
  });

  it("returns insufficient data state", () => {
    const cmp = compareReportAndMeeting([], []);
    expect(cmp.divergences[0]).toContain("Dados insuficientes");
  });
});
