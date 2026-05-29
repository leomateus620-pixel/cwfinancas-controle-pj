import type { Confidence, FinancialKpi, PreMeetingReportPayload } from "./reportsMeetingTypes";

export type SheetCell = string | number | boolean | null | undefined;

export interface WorkbookSheet {
  name: string;
  rows: SheetCell[][];
}

export interface WorkbookSnapshot {
  sourceName: string;
  sheets: WorkbookSheet[];
  provider?: "google_sheets" | "excel_upload" | "fixture" | "manual";
  fetchedAt?: string;
  audit?: string[];
}

export interface FinancialTransaction {
  date?: string;
  account?: string;
  category: string;
  description?: string;
  invoice?: string;
  amount: number;
  rowNumber: number;
}

export interface MonthlyFinancialSummary {
  sheetName: string;
  monthKey: string;
  monthLabel: string;
  year: number;
  month: number;
  revenue: number;
  expenses: number;
  result: number;
  transactionCount: number;
}

export interface ExpenseCategorySummary {
  category: string;
  amount: number;
  shareOfRevenue: number;
}

export interface FinancialWorkbookAnalysis {
  sourceName: string;
  provider: WorkbookSnapshot["provider"];
  latestSheetName: string;
  latestMonthKey: string;
  latestMonthLabel: string;
  revenue: number;
  expenses: number;
  result: number;
  margin: number | null;
  cash: number | null;
  transactions: FinancialTransaction[];
  monthlySeries: MonthlyFinancialSummary[];
  topExpenseCategories: ExpenseCategorySummary[];
  variations: string[];
  risks: string[];
  opportunities: string[];
  suggestedAgenda: string[];
  auditLog: string[];
}

export interface OfflineDreResult {
  fileName: string;
  periodLabel: string;
  rows: (string | number)[][];
  mappingLog: string[];
  warnings: string[];
  generatedAt: string;
}

export interface ReportsMeetingsPackage {
  report: PreMeetingReportPayload;
  analysis: FinancialWorkbookAnalysis;
  offlineDre: OfflineDreResult;
  mode: "live" | "fixture" | "fallback";
  auditLog: string[];
}

interface MonthParts {
  month: number;
  year: number;
  label: string;
  sortKey: number;
  monthKey: string;
}

const MONTH_ALIASES: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  feb: 2,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  march: 3,
  apr: 4,
  abr: 4,
  abril: 4,
  may: 5,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  aug: 8,
  ago: 8,
  agosto: 8,
  sep: 9,
  set: 9,
  setembro: 9,
  oct: 10,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dec: 12,
  dez: 12,
  dezembro: 12,
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const pct = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(value);

export function normalizeLabel(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseCurrencyValue(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const raw = String(input ?? "").replace(/\u00a0/g, " ").trim();
  if (!raw) return null;
  if (/^[-\s]*r?\$?\s*-\s*$/i.test(raw)) return 0;

  const negative = /^-/.test(raw) || /\(.+\)/.test(raw);
  let value = raw
    .replace(/[R$\s]/gi, "")
    .replace(/[()]/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!value || value === "-") return null;
  value = value.replace(/-/g, "");

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    value = lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (lastComma >= 0) {
    value = /,\d{1,2}$/.test(value) ? value.replace(",", ".") : value.replace(/,/g, "");
  } else if (lastDot >= 0 && !/\.\d{1,2}$/.test(value)) {
    value = value.replace(/\./g, "");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

export function parseMonthLabel(label: string): MonthParts | null {
  const normalized = normalizeLabel(label).replace(/[-_]/g, " ");
  const compact = normalized.replace(/\s+/g, "");
  const monthEntry = Object.entries(MONTH_ALIASES).find(([alias]) =>
    normalized.split(" ").some((part) => part.startsWith(alias)) || compact.startsWith(alias),
  );
  if (!monthEntry) return null;

  const yearMatch = normalized.match(/\b(20\d{2}|\d{2})\b/) ?? compact.match(/(20\d{2}|\d{2})$/);
  if (!yearMatch) return null;
  const rawYear = Number(yearMatch[1]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const month = monthEntry[1];
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  return {
    month,
    year,
    label,
    monthKey,
    sortKey: year * 12 + month,
  };
}

function findHeaderRow(rows: SheetCell[][]) {
  const maxRows = Math.min(rows.length, 12);
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
    const normalized = rows[rowIndex].map(normalizeLabel);
    const hasCategory = normalized.some((cell) => ["categoria", "categorias"].includes(cell));
    const hasValue = normalized.some((cell) => ["valor", "vlr"].includes(cell));
    if (hasCategory && hasValue) return rowIndex;
  }
  return -1;
}

function findIndex(headers: SheetCell[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeLabel);
  return headers.findIndex((header) => normalizedCandidates.includes(normalizeLabel(header)));
}

export function detectLatestMonthlySheet(workbook: WorkbookSnapshot): WorkbookSheet {
  const candidates = workbook.sheets
    .map((sheet) => ({ sheet, parts: parseMonthLabel(sheet.name), headerRow: findHeaderRow(sheet.rows) }))
    .filter((item) => item.parts && item.headerRow >= 0)
    .sort((a, b) => b.parts!.sortKey - a.parts!.sortKey);

  if (!candidates.length) {
    throw new Error("Nenhuma aba mensal com colunas de categoria e valor foi encontrada.");
  }

  return candidates[0].sheet;
}

export function extractTransactionsFromSheet(sheet: WorkbookSheet): FinancialTransaction[] {
  const headerRowIndex = findHeaderRow(sheet.rows);
  if (headerRowIndex < 0) return [];

  const headers = sheet.rows[headerRowIndex];
  const dateIndex = findIndex(headers, ["data", "date"]);
  const accountIndex = findIndex(headers, ["conta", "account"]);
  const categoryIndex = findIndex(headers, ["categoria", "categorias", "category"]);
  const descriptionIndex = findIndex(headers, ["descricao", "descrição", "historico", "description"]);
  const invoiceIndex = findIndex(headers, ["nf", "nota", "invoice"]);
  const amountIndex = findIndex(headers, ["valor", "amount"]);

  if (categoryIndex < 0 || amountIndex < 0) return [];

  return sheet.rows.slice(headerRowIndex + 1).flatMap((row, index) => {
    const amount = parseCurrencyValue(row[amountIndex]);
    if (amount == null || amount === 0) return [];
    const category = String(row[categoryIndex] ?? "").trim() || "Sem categoria";
    return [
      {
        date: dateIndex >= 0 ? String(row[dateIndex] ?? "").trim() : undefined,
        account: accountIndex >= 0 ? String(row[accountIndex] ?? "").trim() : undefined,
        category,
        description: descriptionIndex >= 0 ? String(row[descriptionIndex] ?? "").trim() : undefined,
        invoice: invoiceIndex >= 0 ? String(row[invoiceIndex] ?? "").trim() : undefined,
        amount,
        rowNumber: headerRowIndex + index + 2,
      },
    ];
  });
}

export function buildMonthlySummaries(workbook: WorkbookSnapshot): MonthlyFinancialSummary[] {
  return workbook.sheets
    .flatMap((sheet) => {
      const parts = parseMonthLabel(sheet.name);
      if (!parts || findHeaderRow(sheet.rows) < 0) return [];
      const transactions = extractTransactionsFromSheet(sheet);
      if (!transactions.length) return [];
      const revenue = roundCurrency(transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0));
      const expenses = roundCurrency(
        transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
      );
      return [
        {
          sheetName: sheet.name,
          monthKey: parts.monthKey,
          monthLabel: sheet.name,
          year: parts.year,
          month: parts.month,
          revenue,
          expenses,
          result: roundCurrency(revenue - expenses),
          transactionCount: transactions.length,
        },
      ];
    })
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
}

export function normalizeFinancialDataFromWorkbook(workbook: WorkbookSnapshot): FinancialWorkbookAnalysis {
  const latestSheet = detectLatestMonthlySheet(workbook);
  const latestParts = parseMonthLabel(latestSheet.name)!;
  const transactions = extractTransactionsFromSheet(latestSheet);
  const revenue = roundCurrency(transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0));
  const expenses = roundCurrency(
    transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
  );
  const result = roundCurrency(revenue - expenses);
  const margin = revenue ? result / revenue : null;
  const monthlySeries = buildMonthlySummaries(workbook);
  const previous = monthlySeries.length >= 2 ? monthlySeries[monthlySeries.length - 2] : undefined;
  const topExpenseCategories = summarizeExpenseCategories(transactions, revenue);
  const variations = buildVariationMessages(monthlySeries);
  const risks = buildRisks({ revenue, expenses, result, margin, previous, topExpenseCategories });
  const opportunities = buildOpportunities({ revenue, expenses, result, margin, previous, topExpenseCategories });
  const suggestedAgenda = buildSuggestedAgenda({ latestSheetName: latestSheet.name, risks, opportunities, topExpenseCategories });

  return {
    sourceName: workbook.sourceName,
    provider: workbook.provider,
    latestSheetName: latestSheet.name,
    latestMonthKey: latestParts.monthKey,
    latestMonthLabel: latestSheet.name,
    revenue,
    expenses,
    result,
    margin,
    cash: null,
    transactions,
    monthlySeries,
    topExpenseCategories,
    variations,
    risks,
    opportunities,
    suggestedAgenda,
    auditLog: [
      ...(workbook.audit ?? []),
      `Aba mais recente detectada: ${latestSheet.name}.`,
      `${transactions.length} lancamentos normalizados para o periodo ${latestSheet.name}.`,
    ],
  };
}

export function buildPreMeetingReportFromWorkbook(workbook: WorkbookSnapshot): ReportsMeetingsPackage {
  const analysis = normalizeFinancialDataFromWorkbook(workbook);
  const kpis = buildKpis(analysis);
  const offlineDre = fillOfflineDreTemplate(analysis);
  const report: PreMeetingReportPayload = {
    title: `Relatorio pre-reuniao - ${analysis.latestMonthLabel}`,
    period_start: analysis.latestMonthKey,
    period_end: analysis.latestMonthKey,
    source_ids: [workbook.sourceName],
    executive_summary: buildExecutiveSummary(analysis),
    insights: [
      ...analysis.variations,
      `Resultado do periodo: ${money(analysis.result)} (${analysis.margin == null ? "margem indisponivel" : pct(analysis.margin)}).`,
      analysis.topExpenseCategories[0]
        ? `Maior grupo de despesa: ${analysis.topExpenseCategories[0].category} (${money(analysis.topExpenseCategories[0].amount)}).`
        : "Sem despesas relevantes detectadas.",
    ],
    risks: analysis.risks,
    suggested_agenda: analysis.suggestedAgenda,
    report_json: {
      kpis,
      opportunities: analysis.opportunities,
      monthlySeries: analysis.monthlySeries,
      topExpenseCategories: analysis.topExpenseCategories,
      offlineDre,
      auditLog: analysis.auditLog,
    },
  };

  return {
    report,
    analysis,
    offlineDre,
    mode: workbook.provider === "fixture" ? "fixture" : "live",
    auditLog: [
      ...analysis.auditLog,
      `DRE offline preenchida em memoria: ${offlineDre.fileName}.`,
      "Relatorio pre-reuniao gerado localmente com o mesmo contrato usado pela integracao real.",
    ],
  };
}

export function fillOfflineDreTemplate(analysis: FinancialWorkbookAnalysis): OfflineDreResult {
  const topExpenseRows = analysis.topExpenseCategories.slice(0, 5).map((item) => [
    `Despesa - ${item.category}`,
    roundCurrency(item.amount),
    "categoria normalizada",
  ]);

  const rows: (string | number)[][] = [
    ["DRE offline", analysis.latestMonthLabel, "Fonte", analysis.sourceName],
    ["Linha", "Valor", "Mapeamento"],
    ["Receita bruta", analysis.revenue, "soma de lancamentos positivos"],
    ["Despesas", analysis.expenses, "soma absoluta de lancamentos negativos"],
    ["Resultado", analysis.result, "receita bruta - despesas"],
    ["Margem", analysis.margin == null ? 0 : analysis.margin, "resultado / receita"],
    ...topExpenseRows,
  ];

  return {
    fileName: `dre-offline-${analysis.latestMonthKey}.xlsx`,
    periodLabel: analysis.latestMonthLabel,
    rows,
    mappingLog: [
      "Template minimo aplicado porque o template DRE oficial ainda nao foi anexado.",
      "Linha Receita bruta preenchida com lancamentos positivos.",
      "Linha Despesas preenchida com lancamentos negativos em valor absoluto.",
      "Linha Resultado calculada sem escrever na planilha conectada.",
    ],
    warnings: analysis.transactions.length ? [] : ["Nenhum lancamento financeiro foi encontrado para o periodo."],
    generatedAt: new Date().toISOString(),
  };
}

function buildKpis(analysis: FinancialWorkbookAnalysis): FinancialKpi[] {
  const confidence: Confidence = analysis.transactions.length >= 5 ? "high" : "medium";
  return [
    { label: "Receitas", value: analysis.revenue, confidence },
    { label: "Despesas", value: analysis.expenses, confidence },
    { label: "Resultado", value: analysis.result, confidence },
    { label: "Margem", value: analysis.margin == null ? null : analysis.margin, confidence: analysis.margin == null ? "low" : confidence },
  ];
}

function buildExecutiveSummary(analysis: FinancialWorkbookAnalysis) {
  const marginText = analysis.margin == null ? "margem indisponivel" : `margem de ${pct(analysis.margin)}`;
  const topExpense = analysis.topExpenseCategories[0];
  return [
    `${analysis.latestMonthLabel} fechou com ${money(analysis.revenue)} em receitas, ${money(analysis.expenses)} em despesas e resultado de ${money(analysis.result)}.`,
    `O periodo apresenta ${marginText}.`,
    topExpense
      ? `A maior concentracao de despesa esta em ${topExpense.category}, somando ${money(topExpense.amount)}.`
      : "Nao ha concentracao de despesa suficiente para destacar.",
  ].join(" ");
}

function summarizeExpenseCategories(transactions: FinancialTransaction[], revenue: number): ExpenseCategorySummary[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;
    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + Math.abs(transaction.amount));
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      amount: roundCurrency(amount),
      shareOfRevenue: revenue ? amount / revenue : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function buildVariationMessages(series: MonthlyFinancialSummary[]) {
  if (series.length < 2) return ["Historico insuficiente para variacao mensal."];
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];
  const revenueChange = ratioChange(latest.revenue, previous.revenue);
  const expenseChange = ratioChange(latest.expenses, previous.expenses);
  const resultChange = latest.result - previous.result;
  return [
    `Receitas variaram ${pct(revenueChange)} versus ${previous.monthLabel}.`,
    `Despesas variaram ${pct(expenseChange)} versus ${previous.monthLabel}.`,
    `Resultado mudou ${money(resultChange)} versus ${previous.monthLabel}.`,
  ];
}

function buildRisks(input: {
  revenue: number;
  expenses: number;
  result: number;
  margin: number | null;
  previous?: MonthlyFinancialSummary;
  topExpenseCategories: ExpenseCategorySummary[];
}) {
  const risks: string[] = [];
  if (input.result < 0) risks.push("Resultado negativo no ultimo mes exige plano de ajuste.");
  if (input.margin != null && input.margin < 0.1) risks.push("Margem abaixo de 10% pode pressionar caixa e distribuicoes.");
  if (input.previous && input.revenue < input.previous.revenue * 0.85) {
    risks.push("Queda relevante de receita versus mes anterior.");
  }
  const concentrated = input.topExpenseCategories.find((item) => item.shareOfRevenue > 0.2);
  if (concentrated) risks.push(`Despesa concentrada em ${concentrated.category} acima de 20% da receita.`);
  return risks.length ? risks : ["Sem risco financeiro automatico critico no recorte analisado."];
}

function buildOpportunities(input: {
  revenue: number;
  expenses: number;
  result: number;
  margin: number | null;
  previous?: MonthlyFinancialSummary;
  topExpenseCategories: ExpenseCategorySummary[];
}) {
  const opportunities: string[] = [];
  if (input.previous && input.revenue > input.previous.revenue) {
    opportunities.push("Receita cresceu versus o mes anterior; revisar origem do ganho para recorrencia.");
  }
  if (input.result > 0) opportunities.push("Resultado positivo permite discutir reserva, distribuicao e reinvestimento.");
  const category = input.topExpenseCategories[0];
  if (category) opportunities.push(`Revisar ${category.category} para identificar economia sem perder capacidade operacional.`);
  return opportunities.length ? opportunities : ["Validar previsao de recebiveis para ampliar margem nos proximos ciclos."];
}

function buildSuggestedAgenda(input: {
  latestSheetName: string;
  risks: string[];
  opportunities: string[];
  topExpenseCategories: ExpenseCategorySummary[];
}) {
  return [
    `Confirmar se ${input.latestSheetName} e o periodo correto da reuniao.`,
    "Validar receitas, despesas e resultado antes de qualquer decisao operacional.",
    input.topExpenseCategories[0]
      ? `Investigar movimentacoes de ${input.topExpenseCategories[0].category}.`
      : "Checar categorias sem classificacao.",
    input.risks[0],
    input.opportunities[0],
    "Definir responsaveis, prazos e pontos que precisam de conferencia manual.",
  ].filter(Boolean);
}

function ratioChange(current: number, previous: number) {
  if (!previous) return current ? 1 : 0;
  return (current - previous) / Math.abs(previous);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
