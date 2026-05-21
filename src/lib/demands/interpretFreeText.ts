/**
 * Interpretador determinístico de demandas em texto livre.
 * Não usa IA, não inventa dados. Quando não detecta, retorna campos vazios.
 */

export type DetectedType =
  | "pagamento"
  | "recebimento"
  | "nota_fiscal"
  | "boleto"
  | "reembolso"
  | "conciliacao"
  | "outro";

export type DetectedUrgency = "baixa" | "normal" | "alta" | "urgente";

export interface DemandInterpretation {
  summary: string;
  detected_type: DetectedType;
  detected_urgency: DetectedUrgency;
  amounts: string[];
  dates: string[];
  parties: string[];
}

const TYPE_KEYWORDS: Array<{ type: DetectedType; re: RegExp }> = [
  { type: "nota_fiscal", re: /\b(nota fiscal|nf-?e|emiss[aã]o de nf|emitir nf)\b/i },
  { type: "boleto", re: /\b(boleto|cobran[çc]a|sacado|gerar cobran[çc]a)\b/i },
  { type: "reembolso", re: /\b(reembolso|reembolsar|despesa pessoal)\b/i },
  { type: "conciliacao", re: /\b(concilia[çc][aã]o|extrato|conciliar)\b/i },
  { type: "recebimento", re: /\b(recebimento|recebi|entrada|recebemos)\b/i },
  { type: "pagamento", re: /\b(pagar|pagamento|quitar|liquidar|fornecedor)\b/i },
];

const URGENCY_RULES: Array<{ urgency: DetectedUrgency; re: RegExp }> = [
  { urgency: "urgente", re: /\b(urgent[íi]ssimo|urgente|imediato|hoje|agora|vence hoje)\b/i },
  { urgency: "alta", re: /\b(amanh[ãa]|prioridade alta|prioridade|prazo curto)\b/i },
  { urgency: "baixa", re: /\b(sem pressa|quando puder|baixa prioridade)\b/i },
];

const AMOUNT_RE = /R\$\s*[\d.]+(?:,\d{1,2})?/g;
const DATE_RE = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g;
const MONTH_RE = /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:[a-zç]*)\b/gi;
const PARTY_RE = /(?:fornecedor|cliente|empresa|sacado|tomador|para o|para a|do|da)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ&.-]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ&.-]+){0,3})/g;

function detectType(text: string): DetectedType {
  for (const { type, re } of TYPE_KEYWORDS) {
    if (re.test(text)) return type;
  }
  return "outro";
}

function detectUrgency(text: string): DetectedUrgency {
  for (const { urgency, re } of URGENCY_RULES) {
    if (re.test(text)) return urgency;
  }
  return "normal";
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))).slice(0, 8);
}

function buildSummary(text: string, type: DetectedType): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  const truncated = firstSentence.length > 180 ? firstSentence.slice(0, 177) + "..." : firstSentence;
  return truncated;
}

const TYPE_TITLE: Record<DetectedType, string> = {
  pagamento: "Solicitação de pagamento",
  recebimento: "Registro de recebimento",
  nota_fiscal: "Emissão de nota fiscal",
  boleto: "Emissão de cobrança / boleto",
  reembolso: "Solicitação de reembolso",
  conciliacao: "Conciliação bancária",
  outro: "Nova demanda",
};

export function interpretDemand(text: string): DemandInterpretation {
  const safe = (text ?? "").toString();
  const detected_type = detectType(safe);
  return {
    summary: buildSummary(safe, detected_type),
    detected_type,
    detected_urgency: detectUrgency(safe),
    amounts: dedupe(safe.match(AMOUNT_RE) ?? []),
    dates: dedupe([...(safe.match(DATE_RE) ?? []), ...(safe.match(MONTH_RE) ?? [])]),
    parties: dedupe(
      Array.from(safe.matchAll(PARTY_RE)).map((m) => m[1]),
    ),
  };
}

export function buildAutoTitle(interpretation: DemandInterpretation, company: string): string {
  const base = TYPE_TITLE[interpretation.detected_type];
  const c = company.trim();
  return c ? `${base} — ${c}` : base;
}
