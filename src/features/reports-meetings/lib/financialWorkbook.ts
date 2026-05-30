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
  normalizedCategory: string;
  description?: string;
  invoice?: string;
  amount: number;
  rowNumber: number;
  rawRow: SheetCell[];
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

export type CategoryComparisonStatus = "up" | "down" | "stable" | "new" | "missing";

export interface CategoryComparison {
  category: string;
  currentValue: number;
  previousValue: number;
  deltaValue: number;
  deltaPercent: number | null;
  status: CategoryComparisonStatus;
  confidence: Confidence;
  currentLabel?: string;
  previousLabel?: string;
}

export interface WorkbookDreUpdateCell {
  rowIndex: number;
  columnIndex: number;
  label: string;
  value: number;
  source: string;
  confidence: Confidence;
}

export interface WorkbookDreUpdateResult {
  fileName: string;
  sourceWorkbookName: string;
  dreSheetName: string;
  currentMonthLabel: string;
  currentMonthKey: string;
  currentMonthColumnIndex: number;
  labelColumnIndex: number;
  rows: (string | number | boolean | null)[][];
  cellUpdates: WorkbookDreUpdateCell[];
  mappingLog: string[];
  warnings: string[];
  generatedAt: string;
  mode: "source_xlsx_edit";
}

export interface FinancialWorkbookAnalysis {
  sourceName: string;
  provider: WorkbookSnapshot["provider"];
  latestSheetName: string;
  latestMonthKey: string;
  latestMonthLabel: string;
  previousSheetName?: string;
  previousMonthKey?: string;
  revenue: number;
  expenses: number;
  result: number;
  margin: number | null;
  cash: number | null;
  transactions: FinancialTransaction[];
  previousTransactions: FinancialTransaction[];
  monthlySeries: MonthlyFinancialSummary[];
  topExpenseCategories: ExpenseCategorySummary[];
  categoryComparison: CategoryComparison[];
  variations: string[];
  risks: string[];
  opportunities: string[];
  suggestedAgenda: string[];
  auditLog: string[];
}

export interface ReportsMeetingsPackage {
  report: PreMeetingReportPayload;
  analysis: FinancialWorkbookAnalysis;
  dreUpdate: WorkbookDreUpdateResult;
  sourceWorkbook: WorkbookSnapshot;
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

export function monthKeyFromDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  return `${previousYear}-${String(previousMonth).padStart(2, "0")}`;
}

function findHeaderRow(rows: SheetCell[][]) {
  const maxRows = Math.min(rows.length, 16);
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
    const normalized = rows[rowIndex].map(normalizeLabel);
    const hasCategory = normalized.some((cell) => ["categoria", "categorias", "category"].includes(cell));
    const hasValue = normalized.some((cell) => ["valor", "vlr", "amount"].includes(cell));
    if (hasCategory && hasValue) return rowIndex;
  }
  return -1;
}

function findIndex(headers: SheetCell[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeLabel);
  return headers.findIndex((header) => normalizedCandidates.includes(normalizeLabel(header)));
}

function getMonthlySheetCandidates(workbook: WorkbookSnapshot) {
  return workbook.sheets
    .map((sheet) => ({ sheet, parts: parseMonthLabel(sheet.name), headerRow: findHeaderRow(sheet.rows) }))
    .filter((item): item is { sheet: WorkbookSheet; parts: MonthParts; headerRow: number } => Boolean(item.parts) && item.headerRow >= 0)
    .sort((a, b) => a.parts.sortKey - b.parts.sortKey);
}

export function detectMonthlySheetForDate(workbook: WorkbookSnapshot, date = new Date()): WorkbookSheet {
  const targetKey = monthKeyFromDate(date);
  const candidates = getMonthlySheetCandidates(workbook);
  if (!candidates.length) throw new Error("Nenhuma aba mensal com colunas de categoria e valor foi encontrada.");

  const exact = candidates.find((item) => item.parts.monthKey === targetKey);
  if (exact) return exact.sheet;

  const targetSortKey = date.getFullYear() * 12 + date.getMonth() + 1;
  const previousOrCurrentCandidates = candidates.filter((item) => item.parts.sortKey <= targetSortKey);
  const previousOrCurrent = previousOrCurrentCandidates[previousOrCurrentCandidates.length - 1];
  return (previousOrCurrent ?? candidates[candidates.length - 1]).sheet;
}

export function detectPreviousMonthlySheet(workbook: WorkbookSnapshot, currentSheet: WorkbookSheet): WorkbookSheet | null {
  const currentParts = parseMonthLabel(currentSheet.name);
  if (!currentParts) return null;
  const previousKey = previousMonthKey(currentParts.monthKey);
  return getMonthlySheetCandidates(workbook).find((item) => item.parts.monthKey === previousKey)?.sheet ?? null;
}

export function detectLatestMonthlySheet(workbook: WorkbookSnapshot): WorkbookSheet {
  const candidates = getMonthlySheetCandidates(workbook);
  if (!candidates.length) throw new Error("Nenhuma aba mensal com colunas de categoria e valor foi encontrada.");
  return candidates[candidates.length - 1].sheet;
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
        normalizedCategory: normalizeCategory(category),
        description: descriptionIndex >= 0 ? String(row[descriptionIndex] ?? "").trim() : undefined,
        invoice: invoiceIndex >= 0 ? String(row[invoiceIndex] ?? "").trim() : undefined,
        amount,
        rowNumber: headerRowIndex + index + 2,
        rawRow: row,
      },
    ];
  });
}

export function buildMonthlySummaries(workbook: WorkbookSnapshot): MonthlyFinancialSummary[] {
  return getMonthlySheetCandidates(workbook)
    .flatMap(({ sheet, parts }) => {
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

export function normalizeFinancialDataFromWorkbook(
  workbook: WorkbookSnapshot,
  options: { currentDate?: Date } = {},
): FinancialWorkbookAnalysis {
  const currentSheet = detectMonthlySheetForDate(workbook, options.currentDate ?? new Date());
  const currentParts = parseMonthLabel(currentSheet.name)!;
  const previousSheet = detectPreviousMonthlySheet(workbook, currentSheet);
  const transactions = extractTransactionsFromSheet(currentSheet);
  const previousTransactions = previousSheet ? extractTransactionsFromSheet(previousSheet) : [];
  const revenue = roundCurrency(transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0));
  const expenses = roundCurrency(
    transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
  );
  const result = roundCurrency(revenue - expenses);
  const margin = revenue ? result / revenue : null;
  const monthlySeries = buildMonthlySummaries(workbook);
  const previousSummary = previousSheet
    ? monthlySeries.find((item) => item.sheetName === previousSheet.name)
    : undefined;
  const topExpenseCategories = summarizeExpenseCategories(transactions, revenue);
  const categoryComparison = compareCategories(transactions, previousTransactions);
  const variations = buildVariationMessages(monthlySeries, currentSheet.name, previousSheet?.name);
  const risks = buildRisks({ revenue, expenses, result, margin, previous: previousSummary, topExpenseCategories, categoryComparison });
  const opportunities = buildOpportunities({ revenue, expenses, result, margin, previous: previousSummary, topExpenseCategories, categoryComparison });
  const suggestedAgenda = buildSuggestedAgenda({ latestSheetName: currentSheet.name, risks, opportunities, topExpenseCategories });

  return {
    sourceName: workbook.sourceName,
    provider: workbook.provider,
    latestSheetName: currentSheet.name,
    latestMonthKey: currentParts.monthKey,
    latestMonthLabel: currentSheet.name,
    previousSheetName: previousSheet?.name,
    previousMonthKey: previousSheet ? parseMonthLabel(previousSheet.name)?.monthKey : undefined,
    revenue,
    expenses,
    result,
    margin,
    cash: null,
    transactions,
    previousTransactions,
    monthlySeries,
    topExpenseCategories,
    categoryComparison,
    variations,
    risks,
    opportunities,
    suggestedAgenda,
    auditLog: [
      ...(workbook.audit ?? []),
      `Aba do mes atual detectada: ${currentSheet.name}.`,
      previousSheet ? `Aba do mes anterior detectada: ${previousSheet.name}.` : "Mes anterior nao encontrado no workbook.",
      `${transactions.length} lancamentos normalizados para o periodo ${currentSheet.name}.`,
      `${categoryComparison.length} categorias comparadas entre mes atual e anterior.`,
    ],
  };
}

export function buildPreMeetingReportFromWorkbook(
  workbook: WorkbookSnapshot,
  options: { currentDate?: Date } = {},
): ReportsMeetingsPackage {
  const analysis = normalizeFinancialDataFromWorkbook(workbook, options);
  const kpis = buildKpis(analysis);
  const dreUpdate = buildWorkbookDreUpdate(workbook, analysis);
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
      categoryComparison: analysis.categoryComparison,
      dreUpdate,
      auditLog: analysis.auditLog,
    },
  };

  return {
    report,
    analysis,
    dreUpdate,
    sourceWorkbook: workbook,
    mode: workbook.provider === "fixture" ? "fixture" : "live",
    auditLog: [
      ...analysis.auditLog,
      `Workbook XLSX preparado para edicao direta da aba ${dreUpdate.dreSheetName}.`,
      "Relatorio pre-reuniao gerado localmente com o mesmo contrato usado pela integracao real.",
    ],
  };
}

export function detectDreSheet(workbook: WorkbookSnapshot): WorkbookSheet | null {
  const candidates = workbook.sheets.filter((sheet) => {
    const name = normalizeLabel(sheet.name);
    return (
      /\bdre\b/.test(name) ||
      name.includes("d r e") ||
      name.includes("demonstrativo") ||
      name.includes("resultado") ||
      name.includes("caixa")
    );
  });
  return candidates.find((sheet) => normalizeLabel(sheet.name).includes("dre")) ?? candidates[0] ?? null;
}

export function buildWorkbookDreUpdate(workbook: WorkbookSnapshot, analysis: FinancialWorkbookAnalysis): WorkbookDreUpdateResult {
  const dreSheet = detectDreSheet(workbook);
  const rows = cloneRows(dreSheet?.rows ?? buildFallbackDreRows(analysis));
  const dreSheetName = dreSheet?.name ?? "DRE";
  const labelColumnIndex = findDreLabelColumn(rows);
  const monthColumnIndex = findOrCreateDreMonthColumn(rows, analysis.latestMonthKey);
  const updates: WorkbookDreUpdateCell[] = [];
  const mappingLog: string[] = [];
  const warnings: string[] = [];

  rows.forEach((row, rowIndex) => {
    const label = String(row[labelColumnIndex] ?? "").trim();
    if (!label) return;
    const resolved = resolveDreLineValue(label, analysis);
    if (!resolved) return;
    row[monthColumnIndex] = resolved.value;
    updates.push({
      rowIndex,
      columnIndex: monthColumnIndex,
      label,
      value: resolved.value,
      source: resolved.source,
      confidence: resolved.confidence,
    });
    mappingLog.push(`Linha "${label}" atualizada com ${money(resolved.value)} via ${resolved.source}.`);
  });

  if (!dreSheet) warnings.push("Nenhuma aba DRE foi detectada; criada aba DRE dentro do workbook exportado.");
  if (!updates.length) warnings.push("Nenhuma linha da DRE recebeu mapeamento automatico com confianca suficiente.");

  return {
    fileName: buildUpdatedWorkbookFileName(workbook.sourceName, analysis.latestMonthKey),
    sourceWorkbookName: workbook.sourceName,
    dreSheetName,
    currentMonthLabel: analysis.latestMonthLabel,
    currentMonthKey: analysis.latestMonthKey,
    currentMonthColumnIndex: monthColumnIndex,
    labelColumnIndex,
    rows,
    cellUpdates: updates,
    mappingLog,
    warnings,
    generatedAt: new Date().toISOString(),
    mode: "source_xlsx_edit",
  };
}

export function compareCategories(current: FinancialTransaction[], previous: FinancialTransaction[]): CategoryComparison[] {
  const currentTotals = summarizeCategoryTotals(current);
  const previousTotals = summarizeCategoryTotals(previous);
  const keys = new Set([...currentTotals.keys(), ...previousTotals.keys()]);

  return [...keys]
    .map((key) => {
      const currentItem = currentTotals.get(key);
      const previousItem = previousTotals.get(key);
      const currentValue = currentItem?.amount ?? 0;
      const previousValue = previousItem?.amount ?? 0;
      const deltaValue = roundCurrency(currentValue - previousValue);
      const deltaPercent = previousValue ? deltaValue / Math.abs(previousValue) : currentValue ? null : 0;
      const status = classifyCategoryStatus(currentValue, previousValue, deltaValue);
      return {
        category: currentItem?.label ?? previousItem?.label ?? key,
        currentValue,
        previousValue,
        deltaValue,
        deltaPercent,
        status,
        confidence: currentItem && previousItem ? "high" : "medium",
        currentLabel: currentItem?.label,
        previousLabel: previousItem?.label,
      } satisfies CategoryComparison;
    })
    .sort((a, b) => Math.abs(b.deltaValue) - Math.abs(a.deltaValue));
}

function resolveDreLineValue(label: string, analysis: FinancialWorkbookAnalysis) {
  const normalized = normalizeLabel(label);
  const deductions = sumCategoriesByWords(analysis.transactions, ["simples", "imposto", "taxa", "dedu"]);
  const directCosts = sumCategoriesByWords(analysis.transactions, ["custo", "deslocamento", "obra", "rrt"]);

  if (normalized.includes("faturamento") || normalized.includes("receita bruta")) {
    return { value: analysis.revenue, source: "total de lancamentos positivos", confidence: "high" as Confidence };
  }
  if (normalized.includes("receita liquida")) {
    return { value: roundCurrency(analysis.revenue - deductions), source: "receita menos deducoes fiscais", confidence: "medium" as Confidence };
  }
  if (normalized === "receitas") {
    return { value: analysis.revenue, source: "categoria receita/receitas", confidence: "high" as Confidence };
  }
  if (normalized.includes("dedu")) {
    return { value: -deductions, source: "categorias fiscais/deducoes", confidence: deductions ? "medium" as Confidence : "low" as Confidence };
  }
  if (normalized.includes("custos totais") || normalized.includes("custos diretos")) {
    return { value: -directCosts, source: "categorias de custos diretos", confidence: directCosts ? "medium" as Confidence : "low" as Confidence };
  }
  if (normalized.includes("despesas totais")) {
    const expenses = sumExpensesExcludingWords(analysis.transactions, ["simples", "imposto", "taxa", "dedu", "custo", "deslocamento", "obra", "rrt"]);
    return { value: -expenses, source: "despesas exceto deducoes e custos diretos", confidence: expenses ? "medium" as Confidence : "low" as Confidence };
  }

  const exact = analysis.categoryComparison.find((item) => normalizeCategory(item.category) === normalizeCategory(label));
  if (exact) {
    return {
      value: sumCategoryByNormalized(analysis.transactions, normalizeCategory(exact.category)),
      source: `categoria ${exact.category}`,
      confidence: "high" as Confidence,
    };
  }

  const fuzzy = analysis.categoryComparison
    .map((item) => ({ item, score: tokenSimilarity(normalizeCategory(item.category), normalizeCategory(label)) }))
    .filter(({ score }) => score >= 0.5)
    .sort((a, b) => b.score - a.score)[0];
  if (fuzzy) {
    return {
      value: sumCategoryByNormalized(analysis.transactions, normalizeCategory(fuzzy.item.category)),
      source: `aproximacao com categoria ${fuzzy.item.category}`,
      confidence: fuzzy.score > 0.75 ? "medium" as Confidence : "low" as Confidence,
    };
  }

  if (normalized.includes("resultado") || normalized.includes("lucro") || normalized.includes("prejuizo")) {
    return { value: analysis.result, source: "receita menos despesas", confidence: "high" as Confidence };
  }
  if (normalized.includes("margem")) {
    return { value: analysis.margin == null ? 0 : analysis.margin, source: "resultado dividido por receita", confidence: "medium" as Confidence };
  }
  if (normalized.includes("custo")) {
    return { value: -directCosts, source: "categorias de custos diretos", confidence: directCosts ? "medium" as Confidence : "low" as Confidence };
  }
  if (normalized.includes("despesa")) {
    return { value: -analysis.expenses, source: "total de lancamentos negativos", confidence: "medium" as Confidence };
  }

  return null;
}

function findDreLabelColumn(rows: (string | number | boolean | null)[][]) {
  const maxColumns = Math.min(6, Math.max(1, ...rows.map((row) => row.length)));
  const scores = Array.from({ length: maxColumns }, (_, columnIndex) => {
    const score = rows.reduce((total, row) => {
      const raw = row[columnIndex];
      const label = normalizeLabel(raw);
      if (!label || parseCurrencyValue(raw) != null || parseMonthLabel(label)) return total;
      return total + (label.length > 2 ? 1 : 0);
    }, 0);
    return { columnIndex, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.columnIndex ?? 0;
}

function findOrCreateDreMonthColumn(rows: (string | number | boolean | null)[][], monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthAliases = Object.entries(MONTH_ALIASES)
    .filter(([, value]) => value === month)
    .map(([label]) => label);
  const yearTwo = String(year).slice(-2);

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 8); rowIndex++) {
    for (let colIndex = 0; colIndex < (rows[rowIndex]?.length ?? 0); colIndex++) {
      const label = normalizeLabel(rows[rowIndex][colIndex]);
      if (!label) continue;
      const hasMonth = monthAliases.some((alias) => label.includes(alias));
      const hasYear = label.includes(String(year)) || label.includes(yearTwo);
      if (hasMonth && hasYear) return colIndex;
    }
  }

  const firstHeader = rows[0] ?? [];
  const newIndex = Math.max(1, firstHeader.length);
  rows[0] = [...firstHeader];
  rows[0][newIndex] = `${monthAliases[0] ?? month}/${yearTwo}`;
  return newIndex;
}

function buildFallbackDreRows(analysis: FinancialWorkbookAnalysis) {
  return [
    ["DRE", analysis.latestMonthLabel],
    ["Receita bruta", 0],
    ["Despesas", 0],
    ["Resultado", 0],
    ["Margem", 0],
  ];
}

function buildUpdatedWorkbookFileName(sourceName: string, monthKey: string) {
  const base = sourceName.replace(/\.(xlsx|xlsm|xls)$/i, "").replace(/[^\w\s-]/g, "").trim() || "financeiro";
  return `${base}-atualizado-${monthKey}.xlsx`;
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
  const previous = analysis.previousSheetName ? ` comparado com ${analysis.previousSheetName}` : "";
  return [
    `${analysis.latestMonthLabel}${previous} fechou com ${money(analysis.revenue)} em receitas, ${money(analysis.expenses)} em despesas e resultado de ${money(analysis.result)}.`,
    `O periodo apresenta ${marginText}.`,
    topExpense
      ? `A maior concentracao de despesa esta em ${topExpense.category}, somando ${money(topExpense.amount)}.`
      : "Nao ha concentracao de despesa suficiente para destacar.",
  ].join(" ");
}

function summarizeExpenseCategories(transactions: FinancialTransaction[], revenue: number): ExpenseCategorySummary[] {
  const totals = new Map<string, { label: string; amount: number }>();
  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;
    const key = transaction.normalizedCategory;
    const existing = totals.get(key);
    totals.set(key, {
      label: existing?.label ?? transaction.category,
      amount: (existing?.amount ?? 0) + Math.abs(transaction.amount),
    });
  }
  return [...totals.values()]
    .map(({ label, amount }) => ({
      category: label,
      amount: roundCurrency(amount),
      shareOfRevenue: revenue ? amount / revenue : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function buildVariationMessages(series: MonthlyFinancialSummary[], currentSheetName: string, previousSheetName?: string) {
  const latest = series.find((item) => item.sheetName === currentSheetName);
  const previous = previousSheetName ? series.find((item) => item.sheetName === previousSheetName) : undefined;
  if (!latest || !previous) return ["Historico insuficiente para variacao mensal."];
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
  categoryComparison: CategoryComparison[];
}) {
  const risks: string[] = [];
  if (input.result < 0) risks.push("Resultado negativo no ultimo mes exige plano de ajuste.");
  if (input.margin != null && input.margin < 0.1) risks.push("Margem abaixo de 10% pode pressionar caixa e distribuicoes.");
  if (input.previous && input.revenue < input.previous.revenue * 0.85) {
    risks.push("Queda relevante de receita versus mes anterior.");
  }
  const concentrated = input.topExpenseCategories.find((item) => item.shareOfRevenue > 0.2);
  if (concentrated) risks.push(`Despesa concentrada em ${concentrated.category} acima de 20% da receita.`);
  const newCategories = input.categoryComparison.filter((item) => item.status === "new").slice(0, 2);
  if (newCategories.length) risks.push(`Categorias novas exigem conferencia: ${newCategories.map((item) => item.category).join(", ")}.`);
  return risks.length ? risks : ["Sem risco financeiro automatico critico no recorte analisado."];
}

function buildOpportunities(input: {
  revenue: number;
  expenses: number;
  result: number;
  margin: number | null;
  previous?: MonthlyFinancialSummary;
  topExpenseCategories: ExpenseCategorySummary[];
  categoryComparison: CategoryComparison[];
}) {
  const opportunities: string[] = [];
  if (input.previous && input.revenue > input.previous.revenue) {
    opportunities.push("Receita cresceu versus o mes anterior; revisar origem do ganho para recorrencia.");
  }
  if (input.result > 0) opportunities.push("Resultado positivo permite discutir reserva, distribuicao e reinvestimento.");
  const biggestDrop = input.categoryComparison.find((item) => item.status === "down");
  if (biggestDrop) opportunities.push(`${biggestDrop.category} caiu ${money(Math.abs(biggestDrop.deltaValue))}; validar se a reducao e recorrente.`);
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
    "Validar receitas, despesas, resultado e variacoes por categoria.",
    input.topExpenseCategories[0]
      ? `Investigar movimentacoes de ${input.topExpenseCategories[0].category}.`
      : "Checar categorias sem classificacao.",
    input.risks[0],
    input.opportunities[0],
    "Definir responsaveis, prazos e pontos que precisam de conferencia manual.",
  ].filter(Boolean);
}

function summarizeCategoryTotals(transactions: FinancialTransaction[]) {
  const totals = new Map<string, { label: string; amount: number }>();
  for (const transaction of transactions) {
    const key = transaction.normalizedCategory;
    const existing = totals.get(key);
    totals.set(key, {
      label: existing?.label ?? transaction.category,
      amount: roundCurrency((existing?.amount ?? 0) + Math.abs(transaction.amount)),
    });
  }
  return totals;
}

function classifyCategoryStatus(currentValue: number, previousValue: number, deltaValue: number): CategoryComparisonStatus {
  if (currentValue > 0 && previousValue === 0) return "new";
  if (currentValue === 0 && previousValue > 0) return "missing";
  const threshold = Math.max(100, previousValue * 0.03);
  if (Math.abs(deltaValue) <= threshold) return "stable";
  return deltaValue > 0 ? "up" : "down";
}

function normalizeCategory(value: string) {
  return normalizeLabel(value)
    .replace(/\b(mensal|fixa|fixo|apos|após|lucro|pagamento|recebimento)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sumCategoriesByWords(transactions: FinancialTransaction[], words: string[]) {
  const normalizedWords = words.map(normalizeLabel);
  return roundCurrency(
    transactions
      .filter((transaction) => normalizedWords.some((word) => transaction.normalizedCategory.includes(word)))
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
  );
}

function sumCategoryByNormalized(transactions: FinancialTransaction[], normalizedCategory: string) {
  return roundCurrency(
    transactions
      .filter((transaction) => transaction.normalizedCategory === normalizedCategory)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );
}

function sumExpensesExcludingWords(transactions: FinancialTransaction[], words: string[]) {
  const normalizedWords = words.map(normalizeLabel);
  return roundCurrency(
    transactions
      .filter((transaction) => transaction.amount < 0)
      .filter((transaction) => !normalizedWords.some((word) => transaction.normalizedCategory.includes(word)))
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
  );
}

function tokenSimilarity(a: string, b: string) {
  const tokensA = new Set(a.split(/\s+/).filter((token) => token.length > 2));
  const tokensB = new Set(b.split(/\s+/).filter((token) => token.length > 2));
  if (!tokensA.size || !tokensB.size) return 0;
  const intersection = [...tokensA].filter((token) => tokensB.has(token)).length;
  return intersection / Math.max(tokensA.size, tokensB.size);
}

function ratioChange(current: number, previous: number) {
  if (!previous) return current ? 1 : 0;
  return (current - previous) / Math.abs(previous);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function cloneRows(rows: SheetCell[][]): (string | number | boolean | null)[][] {
  return rows.map((row) => row.map((cell) => (cell == null ? null : cell)));
}
