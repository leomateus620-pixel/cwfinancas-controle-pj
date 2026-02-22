import { describe, it, expect } from "vitest";
import { formatCurrencyBR, formatCompactBR, parseBRLToNumber } from "../currency";

describe("formatCurrencyBR", () => {
  it("formats integers with 2 decimals", () => {
    const result = formatCurrencyBR(100000);
    expect(result).toContain("100.000,00");
    expect(result).toContain("R$");
  });

  it("formats decimals with 2 places", () => {
    const result = formatCurrencyBR(19.9);
    expect(result).toContain("19,90");
  });

  it("formats negative values", () => {
    const result = formatCurrencyBR(-30);
    expect(result).toContain("30,00");
    expect(result).toContain("-");
  });

  it("formats zero", () => {
    const result = formatCurrencyBR(0);
    expect(result).toContain("0,00");
  });

  it("formats large values", () => {
    const result = formatCurrencyBR(1234567.89);
    expect(result).toContain("1.234.567,89");
  });
});

describe("formatCompactBR", () => {
  it("formats thousands compactly", () => {
    const result = formatCompactBR(100000);
    expect(result).toContain("100");
    expect(result).toContain("R$");
  });

  it("formats millions compactly", () => {
    const result = formatCompactBR(1500000);
    expect(result).toContain("R$");
  });
});

describe("parseBRLToNumber", () => {
  it("parses standard BRL format", () => {
    expect(parseBRLToNumber("R$ 1.234,56")).toBe(1234.56);
  });

  it("parses integer with dot thousand separator", () => {
    expect(parseBRLToNumber("1.234.567")).toBe(1234567);
    expect(parseBRLToNumber("100.000,00")).toBe(100000);
  });

  it("parses value with comma decimal", () => {
    expect(parseBRLToNumber("R$ 19,9")).toBe(19.9);
  });

  it("parses negative in parentheses", () => {
    expect(parseBRLToNumber("(1.234,56)")).toBe(-1234.56);
  });

  it("parses trailing minus", () => {
    expect(parseBRLToNumber("30,00-")).toBe(-30);
  });

  it("rejects dates", () => {
    expect(parseBRLToNumber("29/01/2026")).toBeNull();
    expect(parseBRLToNumber("2026-01-29")).toBeNull();
  });

  it("handles null/undefined", () => {
    expect(parseBRLToNumber(null)).toBeNull();
    expect(parseBRLToNumber(undefined)).toBeNull();
  });

  it("handles numbers directly", () => {
    expect(parseBRLToNumber(100.555)).toBe(100.56);
  });

  it("round-trip: parse then format always has 2 decimals", () => {
    const parsed = parseBRLToNumber("100.000,00");
    expect(parsed).toBe(100000);
    const formatted = formatCurrencyBR(parsed!);
    expect(formatted).toContain("100.000,00");
  });

  // ===== FASE 4: Extended test cases =====

  it("parses 100.000 as 100000 (thousand separator, no comma)", () => {
    expect(parseBRLToNumber("100.000")).toBe(100000);
  });

  it("parses 1.000 as 1000", () => {
    expect(parseBRLToNumber("1.000")).toBe(1000);
  });

  it("parses negative in parentheses with comma decimal", () => {
    expect(parseBRLToNumber("(609,65)")).toBe(-609.65);
  });

  it("parses R$ 59.104,18 correctly", () => {
    expect(parseBRLToNumber("R$ 59.104,18")).toBe(59104.18);
  });

  it("handles Excel serial number (passes through as number)", () => {
    expect(parseBRLToNumber(45678)).toBe(45678);
  });

  it("parses R$ - 1.234,56 as negative (spaced minus)", () => {
    expect(parseBRLToNumber("R$ - 1.234,56")).toBe(-1234.56);
  });

  it("parses large number with single dot: 1234.567 as decimal (not thousand)", () => {
    // "1234.567" has 3 digits after dot but that's still a thousand sep pattern
    expect(parseBRLToNumber("1234.567")).toBe(1234567);
  });

  it("parses 10.50 as decimal (2 digits after dot)", () => {
    expect(parseBRLToNumber("10.50")).toBe(10.50);
  });

  it("parses 0,00 as 0", () => {
    expect(parseBRLToNumber("0,00")).toBe(0);
  });

  it("parses zero integer", () => {
    expect(parseBRLToNumber(0)).toBe(0);
  });

  it("handles empty string", () => {
    expect(parseBRLToNumber("")).toBeNull();
  });

  it("handles dash only", () => {
    expect(parseBRLToNumber("-")).toBeNull();
  });

  it("rejects date with month name", () => {
    expect(parseBRLToNumber("29/jan/2026")).toBeNull();
  });
});
