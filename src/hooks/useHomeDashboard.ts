import { useMemo } from "react";
import { useProfile } from "./useProfile";
import { useTransactions } from "./useTransactions";
import { useInvoices } from "./useInvoices";
import { useSyncStatus } from "./useSyncStatus";
import { format, startOfMonth, endOfMonth, subMonths, subDays, parseISO, isValid, differenceInDays, addDays } from "date-fns";
import { formatCurrencyBR } from "@/lib/currency";

function extractCompanyFromSheet(name?: string): string | null {
  if (!name) return null;
  let clean = name.replace(/\.(xlsx?|csv)$/i, "");
  clean = clean.replace(/^financeiro\s*/i, "");
  clean = clean.replace(/\s*[-–]\s*\d{4}\s*$/, "");
  clean = clean.replace(/\s+\d{4}\s*$/, "");
  clean = clean.trim();
  return clean || null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export interface HomeDashboardAlert {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  iconName: string;
}

export interface HomeDashboardData {
  greeting: string;
  companyName: string;
  lastSyncAt: string | null;
  currentBalance: number;
  monthIncome: number;
  monthExpense: number;
  monthResult: number;
  receivables: number;
  payables: number;
  variationPercent: number;
  variationValue: number;
  runwayDays: number | null;
  topExpenseCategories: Array<{ name: string; value: number; percent: number }>;
  alerts: HomeDashboardAlert[];
  dailyTrend: Array<{ date: string; value: number }>;
  healthScore: number;
  healthFactors: Array<{ label: string; score: number; weight: number }>;
  isLoading: boolean;
  hasData: boolean;
  hasSyncConnection: boolean;
}

export function useHomeDashboard(): HomeDashboardData {
  const { profile, isLoading: profileLoading } = useProfile();

  const now = new Date();
  // Home always shows current month — bypass global date filter with explicit dates
  const homeStart = format(startOfMonth(now), "yyyy-MM-dd");
  const homeEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { transactions, isLoading: txLoading, totals: allTotals } = useTransactions({
    startDate: homeStart,
    endDate: homeEnd,
  });
  const { invoices, isLoading: invLoading, summary: invSummary } = useInvoices();
  const { connections, isLoading: syncLoading } = useSyncStatus();

  const currentMonthStart = homeStart;
  const currentMonthEnd = homeEnd;
  const prevMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const prevMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

  const computed = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        monthIncome: 0,
        monthExpense: 0,
        prevMonthIncome: 0,
        prevMonthExpense: 0,
        topExpenseCategories: [] as Array<{ name: string; value: number; percent: number }>,
        dailyTrend: [] as Array<{ date: string; value: number }>,
        payables: 0,
      };
    }

    // Current month - exclude transfers
    const currentMonthTx = transactions.filter(t => t.date >= currentMonthStart && t.date <= currentMonthEnd && (t as any).movement_type !== "TRANSFER");
    const monthIncome = currentMonthTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const monthExpense = currentMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    // Previous month - exclude transfers
    const prevMonthTx = transactions.filter(t => t.date >= prevMonthStart && t.date <= prevMonthEnd && (t as any).movement_type !== "TRANSFER");
    const prevMonthIncome = prevMonthTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const prevMonthExpense = prevMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    // Top 3 expense categories
    const categoryMap = new Map<string, number>();
    currentMonthTx.filter(t => t.type === "expense").forEach(t => {
      categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + Number(t.amount));
    });
    const sortedCats = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
    const topExpenseCategories = sortedCats.slice(0, 3).map(([name, value]) => ({
      name,
      value,
      percent: monthExpense > 0 ? (value / monthExpense) * 100 : 0,
    }));

    // Daily trend (last 30 days cumulative balance)
    const thirtyDaysAgo = subDays(now, 30);
    const dailyMap = new Map<string, number>();
    // Init all days
    for (let i = 0; i <= 30; i++) {
      const d = format(addDays(thirtyDaysAgo, i), "yyyy-MM-dd");
      dailyMap.set(d, 0);
    }
    // Sum by day
    transactions.forEach(t => {
      const d = t.date;
      if (d >= format(thirtyDaysAgo, "yyyy-MM-dd") && d <= format(now, "yyyy-MM-dd")) {
        const val = t.type === "income" ? Number(t.amount) : -Number(t.amount);
        dailyMap.set(d, (dailyMap.get(d) || 0) + val);
      }
    });
    // Cumulative
    const dailyTrend: Array<{ date: string; value: number }> = [];
    let cumulative = 0;
    const sortedDays = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [date, val] of sortedDays) {
      cumulative += val;
      dailyTrend.push({ date, value: cumulative });
    }

    // Payables: future expenses
    const today = format(now, "yyyy-MM-dd");
    const payables = transactions
      .filter(t => t.type === "expense" && t.date > today)
      .reduce((s, t) => s + Number(t.amount), 0);

    return { monthIncome, monthExpense, prevMonthIncome, prevMonthExpense, topExpenseCategories, dailyTrend, payables };
  }, [transactions, currentMonthStart, currentMonthEnd, prevMonthStart, prevMonthEnd]);

  const currentBalance = allTotals.balance;
  const monthResult = computed.monthIncome - computed.monthExpense;
  const prevMonthResult = computed.prevMonthIncome - computed.prevMonthExpense;
  const variationValue = monthResult - prevMonthResult;
  const variationPercent = prevMonthResult !== 0 ? (variationValue / Math.abs(prevMonthResult)) * 100 : 0;

  // Runway
  const last90Income = useMemo(() => {
    if (!transactions) return 0;
    const d90 = format(subDays(now, 90), "yyyy-MM-dd");
    return transactions.filter(t => t.type === "expense" && t.date >= d90).reduce((s, t) => s + Number(t.amount), 0);
  }, [transactions]);

  const avgDailyExpense = last90Income / 90;
  const runwayDays = avgDailyExpense > 0 ? Math.round(currentBalance / avgDailyExpense) : null;

  const receivables = invSummary.pendingValue;

  // Health score
  const healthFactors = useMemo(() => {
    const margin = computed.monthIncome > 0 ? (monthResult / computed.monthIncome) * 100 : 0;
    const marginScore = margin > 20 ? 25 : margin > 10 ? 15 : margin > 0 ? 10 : 0;

    const runwayScore = runwayDays === null ? 12 : runwayDays > 90 ? 25 : runwayDays > 60 ? 20 : runwayDays > 30 ? 10 : 0;

    const receivablesRatio = computed.monthIncome > 0 ? (receivables / computed.monthIncome) * 100 : 0;
    const receivablesScore = receivablesRatio < 30 ? 25 : receivablesRatio < 50 ? 15 : 5;

    const trendScore = variationPercent > 5 ? 25 : variationPercent > 0 ? 15 : variationPercent > -10 ? 10 : 0;

    return [
      { label: "Margem de lucro", score: marginScore, weight: 25 },
      { label: "Fôlego de caixa", score: runwayScore, weight: 25 },
      { label: "Contas a receber", score: receivablesScore, weight: 25 },
      { label: "Tendência", score: trendScore, weight: 25 },
    ];
  }, [computed.monthIncome, monthResult, runwayDays, receivables, variationPercent]);

  const healthScore = healthFactors.reduce((s, f) => s + f.score, 0);

  // Alerts
  const alerts = useMemo(() => {
    const list: HomeDashboardAlert[] = [];

    if (computed.prevMonthExpense > 0 && computed.monthExpense > computed.prevMonthExpense * 1.1) {
      const pct = Math.round(((computed.monthExpense / computed.prevMonthExpense) - 1) * 100);
      list.push({
        id: "expense-up",
        title: "Despesas em alta",
        description: `Despesas ${pct}% acima do mês anterior — revise seus gastos.`,
        priority: "high",
        iconName: "TrendingUp",
      });
    }

    if (computed.prevMonthIncome > 0 && computed.monthIncome < computed.prevMonthIncome * 0.85) {
      const pct = Math.round((1 - computed.monthIncome / computed.prevMonthIncome) * 100);
      list.push({
        id: "income-down",
        title: "Queda na receita",
        description: `Receita caiu ${pct}% este mês — acompanhe de perto.`,
        priority: "high",
        iconName: "TrendingDown",
      });
    }

    // Invoices due in 7 days
    if (invoices) {
      const sevenDays = format(addDays(now, 7), "yyyy-MM-dd");
      const today = format(now, "yyyy-MM-dd");
      const dueSoon = invoices.filter(i => i.status === "pending" && i.due_date >= today && i.due_date <= sevenDays);
      if (dueSoon.length > 0) {
        const total = dueSoon.reduce((s, i) => s + Number(i.value), 0);
        list.push({
          id: "invoices-due",
          title: "Faturas vencendo",
          description: `${dueSoon.length} fatura${dueSoon.length > 1 ? "s" : ""} vence${dueSoon.length > 1 ? "m" : ""} nos próximos 7 dias — ${formatCurrencyBR(total)} em aberto.`,
          priority: "medium",
          iconName: "Clock",
        });
      }
    }

    if (runwayDays !== null && runwayDays < 30) {
      list.push({
        id: "runway-low",
        title: "Fôlego baixo",
        description: `Fôlego de caixa: apenas ${runwayDays} dias restantes.`,
        priority: "high",
        iconName: "AlertTriangle",
      });
    }

    // Category concentration
    if (computed.topExpenseCategories.length > 0 && computed.topExpenseCategories[0].percent > 40) {
      list.push({
        id: "category-concentration",
        title: "Concentração de despesas",
        description: `A categoria "${computed.topExpenseCategories[0].name}" concentrou ${Math.round(computed.topExpenseCategories[0].percent)}% das despesas.`,
        priority: "low",
        iconName: "Info",
      });
    }

    return list.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }, [computed, invoices, runwayDays]);

  const isLoading = profileLoading || txLoading || invLoading || syncLoading;
  const hasData = (transactions?.length ?? 0) > 0;
  const hasSyncConnection = (connections?.length ?? 0) > 0;
  const lastSyncAt = connections?.[0]?.last_sync_at ?? null;

  return {
    greeting: getGreeting(),
    companyName: extractCompanyFromSheet(connections?.[0]?.spreadsheet_name) || profile?.company_name || "Sua Empresa",
    lastSyncAt,
    currentBalance,
    monthIncome: computed.monthIncome,
    monthExpense: computed.monthExpense,
    monthResult,
    receivables,
    payables: computed.payables,
    variationPercent,
    variationValue,
    runwayDays,
    topExpenseCategories: computed.topExpenseCategories,
    alerts,
    dailyTrend: computed.dailyTrend,
    healthScore,
    healthFactors,
    isLoading,
    hasData,
    hasSyncConnection,
  };
}
