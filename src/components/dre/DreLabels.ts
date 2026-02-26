export interface DreLabel {
  simple: string;
  tooltip: string;
}

const normalize = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const LABEL_MAP: Record<string, DreLabel> = {
  "faturamento": {
    simple: "Faturamento",
    tooltip: "Total de receitas brutas geradas no período.",
  },
  "deducoes": {
    simple: "Impostos e taxas",
    tooltip: "Impostos, taxas e deduções aplicadas sobre o faturamento bruto.",
  },
  "receita liquida": {
    simple: "Quanto sobrou após impostos",
    tooltip: "Receita restante após descontar impostos e deduções do faturamento.",
  },
  "despesas totais": {
    simple: "Gastos do mês",
    tooltip: "Soma de todos os custos e despesas operacionais do período.",
  },
  "total despesas": {
    simple: "Gastos do mês",
    tooltip: "Soma de todos os custos e despesas operacionais do período.",
  },
  "custos totais": {
    simple: "Custos totais",
    tooltip: "Soma dos custos diretos de produção ou prestação de serviço.",
  },
  "custos diretos": {
    simple: "Custos diretos",
    tooltip: "Gastos diretamente ligados à produção do serviço ou produto.",
  },
  "resultado": {
    simple: "Lucro/Prejuízo do mês",
    tooltip: "Resultado final: quanto sobrou (lucro) ou faltou (prejuízo) no período.",
  },
  "resultado mes": {
    simple: "Lucro/Prejuízo do mês",
    tooltip: "Resultado final: quanto sobrou (lucro) ou faltou (prejuízo) no período.",
  },
  "resultado do mes": {
    simple: "Lucro/Prejuízo do mês",
    tooltip: "Resultado final: quanto sobrou (lucro) ou faltou (prejuízo) no período.",
  },
  "resultado operacional": {
    simple: "Resultado operacional",
    tooltip: "Lucro gerado apenas pela operação, antes de itens não-operacionais.",
  },
  "lucro operacional": {
    simple: "Lucro operacional",
    tooltip: "Lucro gerado apenas pelas operações do negócio.",
  },
  "margem liquida": {
    simple: "Quanto virou lucro (%)",
    tooltip: "Percentual do faturamento que se transformou em lucro efetivo.",
  },
  "resultado apos investimentos": {
    simple: "Resultado após investimentos",
    tooltip: "Lucro remanescente após descontar investimentos realizados.",
  },
  "investimentos": {
    simple: "Investimentos",
    tooltip: "Valores investidos no período (equipamentos, infraestrutura, etc.).",
  },
};

export function getSimpleLabel(technicalLabel: string): string {
  const norm = normalize(technicalLabel);
  for (const [key, val] of Object.entries(LABEL_MAP)) {
    if (norm.includes(key)) return val.simple;
  }
  return technicalLabel;
}

export function getTooltip(technicalLabel: string): string | null {
  const norm = normalize(technicalLabel);
  for (const [key, val] of Object.entries(LABEL_MAP)) {
    if (norm.includes(key)) return val.tooltip;
  }
  return null;
}

export function formatPeriodLabel(key: string, label?: string | null): string {
  if (label) return label;
  // Year-scoped TOTAL
  const totalMatch = key.match(/^(\d{4})-TOTAL$/);
  if (totalMatch) return `TOTAL ${totalMatch[1]}`;
  if (key === "TOTAL") return "TOTAL";
  if (key.startsWith("REVIEW_")) return `⚠️ ${key.replace("REVIEW_", "")}`;
  const match = key.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(match[2]) - 1]}/${match[1]}`;
  }
  return key;
}

export function extractYearFromPeriodKey(key: string): number | null {
  const match = key.match(/^(\d{4})/);
  return match ? parseInt(match[1]) : null;
}
