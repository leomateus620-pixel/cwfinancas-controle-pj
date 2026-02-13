/**
 * Centralized BRL currency formatting utilities.
 * Single source of truth — all monetary display MUST use these functions.
 */

/**
 * Format a number as BRL currency with exactly 2 decimal places.
 * Use for: cards, tables, tooltips, exports, any monetary display.
 * 
 * @example formatCurrencyBR(100000) => "R$ 100.000,00"
 * @example formatCurrencyBR(-30) => "-R$ 30,00"
 * @example formatCurrencyBR(19.9) => "R$ 19,90"
 */
export const formatCurrencyBR = (amount: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format a number as compact BRL for chart axes where space is limited.
 * 
 * @example formatCompactBR(100000) => "R$ 100 mil"
 * @example formatCompactBR(1500000) => "R$ 1,5 mi"
 */
export const formatCompactBR = (amount: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
};

/**
 * Parse a BRL-formatted string into a number with 2 decimal precision.
 * Handles: "R$ 1.234,56", "100.000", "(1.234,56)", "30,00-"
 * Rejects values that look like dates.
 * 
 * @returns number rounded to 2 decimal places, or null if unparseable
 */
export const parseBRLToNumber = (raw: string | number | null | undefined): number | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return isNaN(raw) ? null : Math.round(raw * 100) / 100;

  let str = String(raw).trim();
  if (!str) return null;

  // Reject dates
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  if (/^\d{1,2}[\/\-][a-zA-Záéíóúâêîôûãõ]+[\/\-]\d{2,4}$/i.test(str)) return null;

  // Remove currency symbols and letters
  str = str.replace(/[R$¤€£¥a-zA-Z]/gi, "");
  // Remove invisible chars
  str = str.replace(/[\u00A0\u2007\u202F\u200B\uFEFF]/g, "");
  str = str.replace(/\s+/g, "");

  if (!str || str === "-" || str === "+" || str === "--") return null;

  // Detect negative
  const isNegativeParens = str.startsWith("(") && str.endsWith(")");
  if (isNegativeParens) str = str.slice(1, -1);

  const isNegativePrefix = str.startsWith("-");
  const isNegativeSuffix = str.endsWith("-");
  str = str.replace(/^-+|-+$/g, "");

  if (!str) return null;

  // Determine decimal separator
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;

  let normalized = str;

  if (lastComma > lastDot) {
    // "1.234,56" -> comma is decimal
    normalized = str.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && lastComma >= 0) {
    // "1,234.56" -> dot is decimal
    normalized = str.replace(/,/g, "");
  } else if (lastComma >= 0 && lastDot === -1) {
    // Only commas
    if (commaCount === 1) {
      const afterComma = str.split(",")[1];
      normalized = afterComma && afterComma.length <= 2
        ? str.replace(",", ".")  // "1234,56" -> decimal
        : str.replace(",", "");  // "1,000" -> thousand sep
    } else {
      normalized = str.replace(/,/g, "");
    }
  } else if (lastDot >= 0 && lastComma === -1) {
    // Only dots present
    if (dotCount >= 2) {
      // "1.234.567" -> all dots are thousand separators
      normalized = str.replace(/\./g, "");
    } else {
      // Single dot: check if after-dot part has exactly 3 digits (thousand sep)
      const afterDot = str.substring(lastDot + 1);
      if (/^\d{3}$/.test(afterDot)) {
        // "100.000" -> thousand separator
        normalized = str.replace(".", "");
      }
      // else "123.45" -> decimal, leave as-is
    }
  }

  const num = parseFloat(normalized);
  if (isNaN(num)) return null;

  const isNegative = isNegativeParens || isNegativePrefix || isNegativeSuffix;
  const result = isNegative ? -num : num;

  return Math.round(result * 100) / 100;
};
