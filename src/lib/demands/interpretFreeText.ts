/**
 * Interpretador determinístico de demandas em texto livre.
 * Não usa IA, não inventa dados. Quando não detecta, retorna campos vazios/nulos.
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
  amount_numeric: number | null;
  dates: string[];
  due_date_iso: string | null;
  parties: string[];
}

const TYPE_KEYWORDS: Array<{ type: DetectedType; re: RegExp }> = [
  { type: "nota_fiscal", re: /\b(nota fiscal|nf-?e|emiss[aã]o de nf|emitir nf|lance uma nota|emitir nota)\b/i },
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

// --- Valores monetários ---
// 1) R$ explícito: R$ 1.400,00 / R$1400 / R$ 1.400
const AMOUNT_BRL_RE = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;
// 2) número seguido de "reais" / "real" / "BRL": 1400 reais, 1.400,00 reais, 2 mil reais
const AMOUNT_REAIS_RE = /\b(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|brl)\b/gi;
// 3) "no valor de 1400" / "valor de R$ 1400" / "valor: 1400"
const AMOUNT_VALOR_RE = /\bvalor(?:\s+de|\s*:)?\s*R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;
// 4) Números por extenso simples
const EXTENSO_RE = /\b((?:um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez)\s+mil(?:\s+e\s+(?:cem|duzentos|trezentos|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos))?|mil(?:\s+e\s+(?:cem|duzentos|trezentos|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos))?)\s*(?:reais|real)\b/gi;

const EXTENSO_MAP: Record<string, number> = {
  um: 1, dois: 2, tres: 3, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  cem: 100, duzentos: 200, trezentos: 300, quatrocentos: 400,
  quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};

function parseExtenso(expr: string): number | null {
  const s = expr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // captura "<n> mil [e <centena>]" ou "mil [e <centena>]"
  const m = s.match(/^(?:(\w+)\s+)?mil(?:\s+e\s+(\w+))?$/);
  if (!m) return null;
  const milhar = m[1] ? EXTENSO_MAP[m[1]] : 1;
  const centena = m[2] ? EXTENSO_MAP[m[2]] ?? 0 : 0;
  if (!milhar) return null;
  return milhar * 1000 + centena;
}

function parseBRLNumber(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim();
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // 1.400,00 -> remove pontos, troca vírgula por ponto
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // 1400,00 -> troca vírgula por ponto
    s = s.replace(",", ".");
  } else if (hasDot) {
    // ambíguo: "1.400" pode ser milhar; se houver exatamente 3 dígitos depois do ponto, trata como milhar
    const parts = s.split(".");
    if (parts.every((p, i) => (i === 0 ? p.length >= 1 : p.length === 3))) {
      s = parts.join("");
    }
  }
  const n = Number(s);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function fmtBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function extractAmounts(text: string): { display: string[]; firstNumeric: number | null } {
  const found: number[] = [];
  const collect = (re: RegExp) => {
    for (const m of text.matchAll(re)) {
      const n = parseBRLNumber(m[1]);
      if (n != null) found.push(n);
    }
  };
  collect(AMOUNT_BRL_RE);
  collect(AMOUNT_REAIS_RE);
  collect(AMOUNT_VALOR_RE);
  for (const m of text.matchAll(EXTENSO_RE)) {
    const n = parseExtenso(m[1]);
    if (n != null) found.push(n);
  }
  // dedupe preservando ordem
  const seen = new Set<number>();
  const unique: number[] = [];
  for (const n of found) {
    if (!seen.has(n)) { seen.add(n); unique.push(n); }
  }
  return {
    display: unique.slice(0, 6).map(fmtBRL),
    firstNumeric: unique[0] ?? null,
  };
}

// --- Datas ---
const DATE_FULL_RE = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g;
const MONTH_RE = /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:[a-zç]*)\b/gi;

function toIsoDate(d: number, m: number, y: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const year = y < 100 ? 2000 + y : y;
  const dt = new Date(Date.UTC(year, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function extractDates(text: string): { display: string[]; firstIso: string | null } {
  const display: string[] = [];
  let firstIso: string | null = null;
  const currentYear = new Date().getFullYear();
  for (const m of text.matchAll(DATE_FULL_RE)) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yy = m[3] ? Number(m[3]) : currentYear;
    const iso = toIsoDate(dd, mm, yy);
    if (iso) {
      display.push(m[3] ? `${String(dd).padStart(2,"0")}/${String(mm).padStart(2,"0")}/${yy}` : `${String(dd).padStart(2,"0")}/${String(mm).padStart(2,"0")}`);
      if (!firstIso) firstIso = iso;
    }
  }
  for (const m of text.matchAll(MONTH_RE)) {
    display.push(m[0]);
  }
  const unique = Array.from(new Set(display)).slice(0, 6);
  return { display: unique, firstIso };
}

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

function buildSummary(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  return firstSentence.length > 180 ? firstSentence.slice(0, 177) + "..." : firstSentence;
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
  const amounts = extractAmounts(safe);
  const dates = extractDates(safe);
  return {
    summary: buildSummary(safe),
    detected_type: detectType(safe),
    detected_urgency: detectUrgency(safe),
    amounts: amounts.display,
    amount_numeric: amounts.firstNumeric,
    dates: dates.display,
    due_date_iso: dates.firstIso,
    parties: dedupe(Array.from(safe.matchAll(PARTY_RE)).map((m) => m[1])),
  };
}

export function buildAutoTitle(interpretation: DemandInterpretation, company: string): string {
  const base = TYPE_TITLE[interpretation.detected_type];
  const c = company.trim();
  return c ? `${base} — ${c}` : base;
}
