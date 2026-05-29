import { describe, expect, it } from "vitest";
import { financeGr2026WorkbookFixture } from "../../test-fixtures/financeGr2026Fixture";
import {
  buildPreMeetingReportFromWorkbook,
  detectLatestMonthlySheet,
  fillOfflineDreTemplate,
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
    expect(analysis.auditLog.join(" ")).toContain("Aba mais recente");
  });

  it("preenche uma DRE offline sem alterar a fonte", () => {
    const analysis = normalizeFinancialDataFromWorkbook(financeGr2026WorkbookFixture);
    const dre = fillOfflineDreTemplate(analysis);
    expect(dre.fileName).toContain("2026-05");
    expect(dre.rows.flat()).toContain("Receita bruta");
    expect(dre.mappingLog.join(" ")).toContain("Template minimo");
  });

  it("monta pacote de pre-reuniao com KPIs, riscos e DRE", () => {
    const pkg = buildPreMeetingReportFromWorkbook(financeGr2026WorkbookFixture);
    expect(pkg.report.executive_summary).toContain("Mai2026");
    expect(pkg.report.suggested_agenda.length).toBeGreaterThan(3);
    expect(pkg.offlineDre.rows.length).toBeGreaterThan(5);
  });
});
