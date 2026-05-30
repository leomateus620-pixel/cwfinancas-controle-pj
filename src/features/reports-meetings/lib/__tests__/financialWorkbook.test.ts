import { describe, expect, it } from "vitest";
import { financeGr2026WorkbookFixture } from "../../test-fixtures/financeGr2026Fixture";
import {
  buildPreMeetingReportFromWorkbook,
  buildWorkbookDreUpdate,
  detectLatestMonthlySheet,
  normalizeFinancialDataFromWorkbook,
  parseCurrencyValue,
  parseMonthLabel,
} from "../financialWorkbook";

describe("financial workbook analysis", () => {
  it("detecta a ultima aba mensal disponivel", () => {
    expect(detectLatestMonthlySheet(financeGr2026WorkbookFixture).name).toBe("Mai2026");
    expect(parseMonthLabel("Mai2026")?.monthKey).toBe("2026-05");
  });

  it("normaliza moeda em formatos BR e US", () => {
    expect(parseCurrencyValue("R$ 30,729.00")).toBe(30729);
    expect(parseCurrencyValue("R$ 30.729,00")).toBe(30729);
    expect(parseCurrencyValue("-R$ 3,829.50")).toBe(-3829.5);
    expect(parseCurrencyValue("R$ -")).toBe(0);
  });

  it("gera analise financeira do ultimo mes", () => {
    const analysis = normalizeFinancialDataFromWorkbook(financeGr2026WorkbookFixture);
    expect(analysis.latestSheetName).toBe("Mai2026");
    expect(analysis.revenue).toBeGreaterThan(20000);
    expect(analysis.expenses).toBeGreaterThan(20000);
    expect(analysis.topExpenseCategories[0].category).toContain("Distribuicao");
    expect(analysis.auditLog.join(" ")).toContain("Aba do mes atual");
  });

  it("edita a aba DRE do workbook para o mes atual", () => {
    const analysis = normalizeFinancialDataFromWorkbook(financeGr2026WorkbookFixture, {
      currentDate: new Date("2026-05-30T12:00:00-03:00"),
    });
    const dre = buildWorkbookDreUpdate(financeGr2026WorkbookFixture, analysis);
    expect(dre.fileName).toBe("Financeiro GR - 2026 1-atualizado-2026-05.xlsx");
    expect(dre.dreSheetName).toBe("DRE-Caixa");
    expect(dre.currentMonthColumnIndex).toBe(5);
    expect(dre.cellUpdates.some((cell) => cell.label.trim() === "FATURAMENTO")).toBe(true);
    expect(dre.mappingLog.join(" ")).toContain("FATURAMENTO");
  });

  it("monta pacote de pre-reuniao com KPIs, riscos e DRE", () => {
    const pkg = buildPreMeetingReportFromWorkbook(financeGr2026WorkbookFixture, {
      currentDate: new Date("2026-05-30T12:00:00-03:00"),
    });
    expect(pkg.report.executive_summary).toContain("Mai2026");
    expect(pkg.report.suggested_agenda.length).toBeGreaterThan(3);
    expect(pkg.dreUpdate.rows.length).toBeGreaterThan(5);
    expect(pkg.analysis.categoryComparison.length).toBeGreaterThan(0);
  });
});
