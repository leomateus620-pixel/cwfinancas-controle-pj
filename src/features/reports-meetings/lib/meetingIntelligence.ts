import { ACTION_KEYWORDS, RISK_KEYWORDS, VARIATION_ALERT_THRESHOLD } from "./reportAnalysisRules";

const toNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function extractKpis(financial: Record<string, unknown>) {
  const revenue = toNum(financial.revenue);
  const expenses = toNum(financial.expenses);
  const cash = toNum(financial.cash);
  const result = revenue != null && expenses != null ? revenue - expenses : null;
  return [
    { label: "Receitas", value: revenue, confidence: revenue == null ? "low" : "high" },
    { label: "Despesas", value: expenses, confidence: expenses == null ? "low" : "high" },
    { label: "Resultado", value: result, confidence: result == null ? "low" : "medium" },
    { label: "Caixa", value: cash, confidence: cash == null ? "low" : "medium" },
  ];
}

export function detectRelevantVariations(series: number[]) {
  if (series.length < 2) return [];
  return series.slice(1).flatMap((current, i) => {
    const prev = series[i];
    if (!prev) return [];
    const variation = (current - prev) / Math.abs(prev);
    return Math.abs(variation) >= VARIATION_ALERT_THRESHOLD ? [{ index: i + 1, variation }] : [];
  });
}

export function extractActionsFromTranscript(text: string) {
  return text.split(/[\n.]/).map((line) => line.trim()).filter((line) => ACTION_KEYWORDS.some((k) => line.toLowerCase().includes(k)));
}

export function detectMentionedNumbers(text: string) {
  return [...text.matchAll(/\b\d+[.,]?\d*\b/g)].map((m) => Number(m[0].replace(",", "."))).filter(Number.isFinite);
}

export function compareReportAndMeeting(kpis: { label: string; value: number | null }[], mentionedNumbers: number[]) {
  if (!kpis.length || !mentionedNumbers.length) return { divergences: ["Dados insuficientes para concluir."], alignmentScore: 0 };
  const divergences: string[] = [];
  let matched = 0;
  for (const kpi of kpis) {
    if (kpi.value == null) continue;
    const hasMatch = mentionedNumbers.some((n) => Math.abs(n - kpi.value!) / Math.max(1, Math.abs(kpi.value!)) < 0.08);
    if (hasMatch) matched++;
    else divergences.push(`Valor de ${kpi.label} não foi confirmado na reunião.`);
  }
  const alignmentScore = Math.round((matched / Math.max(1, kpis.filter((k) => k.value != null).length)) * 100);
  return { divergences: divergences.length ? divergences : ["Sem divergências relevantes."], alignmentScore };
}

export function classifyRisk(text: string) {
  const found = RISK_KEYWORDS.some((k) => text.toLowerCase().includes(k));
  return found ? "high" : "low";
}
