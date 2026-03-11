import { useMemo } from "react";
import { useProfile } from "./useProfile";
import { useTransactions } from "./useTransactions";
import { useInvoices } from "./useInvoices";
import { useSyncStatus } from "./useSyncStatus";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, subDays, addDays } from "date-fns";
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
  variationPercent: number;
  variationValue: number;
  runwayDays: number | null;
  topExpenseCategories: Array<{ name: string; value: number; percent: number }>;
  alerts: HomeDashboardAlert[];
  dailyTrend: Array<{ date: string; value: number }>;
  healthScore: number;
  healthFactors: Array<{ label: string; score: number; weight: number }>;
  trendLabel: string;
  trendPercent: number;
  profitQuality: number | null;
  profitQualityPrev: number | null;
  profitQualityHistory: Array<{ month: string; value: number }>;
  isLoading: boolean;
  hasData: boolean;
  hasSyncConnection: boolean;
}

export function useHomeDashboard(): HomeDashboardData {
  const { profile, isLoading: profileLoading } = useProfile();
  const { session } = useAuth();

  const now = new Date();
  const currStart = format(startOfMonth(now), "yyyy-MM-dd");
  const currEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const prevStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const prevEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

  // Single query for both months (current + previous) to reduce round-trips
  const { transactions: allHomeTx, isLoading: txLoading } = useTransactions({
    startDate: prevStart,
    endDate: currEnd,
  });

  // Split into current and previous month
  const currTx = useMemo(() => (allHomeTx || []).filter(t => t.date >= currStart && t.date <= currEnd), [allHomeTx, currStart, currEnd]);
  const prevTx = useMemo(() => (allHomeTx || []).filter(t => t.date >= prevStart && t.date <= prevEnd), [allHomeTx, prevStart, prevEnd]);
  const prevTxLoading = false; // Covered by single query
  const { invoices, isLoading: invLoading } = useInvoices();
  const { connections, isLoading: syncLoading } = useSyncStatus();

  // Fetch DRE data for profit quality
  const { data: dreData, isLoading: dreLoading } = useQuery({
    queryKey: ["home-dre-profit-quality"],
    queryFn: async () => {
      // Get last 12 months of DRE periods
      const twelveMonthsAgo = format(subMonths(now, 12), "yyyy-MM");
      const currentMonth = format(now, "yyyy-MM");

      const { data: periods, error: pErr } = await supabase
        .from("dre_periods")
        .select("id, period_key, period_label")
        .gte("period_key", twelveMonthsAgo)
        .lte("period_key", currentMonth)
        .neq("period_key", "TOTAL")
        .order("period_key", { ascending: true });

      if (pErr || !periods || periods.length === 0) return null;

      const periodIds = periods.map(p => p.id);
      const { data: lines, error: lErr } = await supabase
        .from("dre_lines")
        .select("period_id, line_label, value, is_subtotal, is_group, group_label")
        .in("period_id", periodIds);

      if (lErr || !lines) return null;

      // For each period, find "resultado" (lucro líquido)
      const results: Array<{ periodKey: string; lucroLiquido: number }> = [];
      for (const period of periods) {
        const pLines = lines.filter(l => l.period_id === period.id);
        const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const resultLine = pLines.find(l => l.is_subtotal && normalize(l.line_label).includes("resultado"));
        if (resultLine) {
          results.push({ periodKey: period.period_key, lucroLiquido: resultLine.value });
        }
      }
      return results;
    },
    enabled: !!session,
  });

  // Combine both queries for trend/runway calculations
  const allTx = useMemo(() => [...(currTx || []), ...(prevTx || [])], [currTx, prevTx]);

  const computed = useMemo(() => {
    // Current month KPIs - use only currTx
    const currentMonthTx = (currTx || []).filter(t => (t as any).movement_type !== "TRANSFER");
    const monthIncome = currentMonthTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const monthExpense = currentMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    // Previous month - use only prevTx
    const prevMonthTx = (prevTx || []).filter(t => (t as any).movement_type !== "TRANSFER");
    const prevMonthIncome = prevMonthTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const prevMonthExpense = prevMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    // Top 5 expense categories (current month only)
    const categoryMap = new Map<string, number>();
    currentMonthTx.filter(t => t.type === "expense").forEach(t => {
      categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + Number(t.amount));
    });
    const sortedCats = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
    const topExpenseCategories = sortedCats.slice(0, 5).map(([name, value]) => ({
      name,
      value,
      percent: monthExpense > 0 ? (value / monthExpense) * 100 : 0,
    }));

    // Daily trend (last 30 days cumulative) - combine both queries
    const thirtyDaysAgo = subDays(now, 30);
    const dailyMap = new Map<string, number>();
    for (let i = 0; i <= 30; i++) {
      const d = format(addDays(thirtyDaysAgo, i), "yyyy-MM-dd");
      dailyMap.set(d, 0);
    }
    allTx.forEach(t => {
      const d = t.date;
      if (d >= format(thirtyDaysAgo, "yyyy-MM-dd") && d <= format(now, "yyyy-MM-dd")) {
        const val = t.type === "income" ? Number(t.amount) : -Number(t.amount);
        dailyMap.set(d, (dailyMap.get(d) || 0) + val);
      }
    });
    const dailyTrend: Array<{ date: string; value: number }> = [];
    let cumulative = 0;
    const sortedDays = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [date, val] of sortedDays) {
      cumulative += val;
      dailyTrend.push({ date, value: cumulative });
    }

    // Trend: last 30 days vs prev 30 days (combine both queries)
    const today = format(now, "yyyy-MM-dd");
    const d30ago = format(subDays(now, 30), "yyyy-MM-dd");
    const d60ago = format(subDays(now, 60), "yyyy-MM-dd");

    const opTx = allTx.filter(t => (t as any).movement_type !== "TRANSFER");
    const last30 = opTx.filter(t => t.date >= d30ago && t.date <= today);
    const prev30 = opTx.filter(t => t.date >= d60ago && t.date < d30ago);

    const last30Income = last30.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const last30Expense = last30.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const prev30Income = prev30.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const prev30Expense = prev30.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    return { monthIncome, monthExpense, prevMonthIncome, prevMonthExpense, topExpenseCategories, dailyTrend, last30Income, last30Expense, prev30Income, prev30Expense };
  }, [currTx, prevTx, allTx]);

  const currentBalance = allTotals.balance;
  const monthResult = computed.monthIncome - computed.monthExpense;
  const prevMonthResult = computed.prevMonthIncome - computed.prevMonthExpense;
  const variationValue = monthResult - prevMonthResult;
  const variationPercent = prevMonthResult !== 0 ? (variationValue / Math.abs(prevMonthResult)) * 100 : 0;

  // Runway (fôlego) - use last 30 days of operational expenses
  const avgDailyExpense = useMemo(() => {
    if (allTx.length === 0) return 0;
    const d30 = format(subDays(now, 30), "yyyy-MM-dd");
    const today = format(now, "yyyy-MM-dd");
    const opExpenses = allTx.filter(
      t => t.type === "expense" && t.date >= d30 && t.date <= today && (t as any).movement_type !== "TRANSFER"
    );
    const totalExpense = opExpenses.reduce((s, t) => s + Number(t.amount), 0);
    const daysWithData = new Set(opExpenses.map(t => t.date)).size;
    return daysWithData > 0 ? Math.abs(totalExpense) / daysWithData : 0;
  }, [allTx]);

  const runwayDays = useMemo(() => {
    if (currentBalance <= 0) return 0;
    if (avgDailyExpense === 0 && currentBalance > 0) return null; // infinity
    return Math.round(currentBalance / avgDailyExpense);
  }, [currentBalance, avgDailyExpense]);

  // Trend calculation
  const { trendLabel, trendPercent } = useMemo(() => {
    const last30Result = computed.last30Income - computed.last30Expense;
    const prev30Result = computed.prev30Income - computed.prev30Expense;
    let pct = 0;
    if (prev30Result !== 0) {
      pct = ((last30Result - prev30Result) / Math.abs(prev30Result)) * 100;
    }
    let label = "Estável";
    if (pct > 5) label = "Melhorando";
    else if (pct < -5) label = "Piorando";
    return { trendLabel: label, trendPercent: Math.round(pct * 10) / 10 };
  }, [computed]);

  // Health score: 3 factors (40/40/20)
  const healthFactors = useMemo(() => {
    // 1) Resultado operacional (40)
    const margin = computed.monthIncome > 0 ? (monthResult / computed.monthIncome) * 100 : 0;
    let resultScore: number;
    if (margin > 20) resultScore = 40;
    else if (margin > 10) resultScore = 25;
    else if (margin > 0) resultScore = 15;
    else resultScore = 0;

    // 2) Fôlego de caixa (40)
    let runwayScore: number;
    if (runwayDays === null) runwayScore = 40; // infinity
    else if (runwayDays > 90) runwayScore = 40;
    else if (runwayDays > 60) runwayScore = 30;
    else if (runwayDays > 30) runwayScore = 15;
    else runwayScore = 5;

    // 3) Tendência (20)
    let trendScoreVal: number;
    if (trendPercent > 5) trendScoreVal = 20;
    else if (trendPercent >= -5) trendScoreVal = 12;
    else trendScoreVal = 4;

    return [
      { label: "Resultado operacional", score: resultScore, weight: 40 },
      { label: "Fôlego de caixa", score: runwayScore, weight: 40 },
      { label: "Tendência", score: trendScoreVal, weight: 20 },
    ];
  }, [computed.monthIncome, monthResult, runwayDays, trendPercent]);

  const healthScore = healthFactors.reduce((s, f) => s + f.score, 0);

  // Profit Quality: (Fluxo de Caixa Operacional / Lucro Líquido DRE) * 100
  const { profitQuality, profitQualityPrev, profitQualityHistory } = useMemo(() => {
    if (!dreData || dreData.length === 0) {
      return { profitQuality: null, profitQualityPrev: null, profitQualityHistory: [] };
    }

    const currentPeriodKey = format(now, "yyyy-MM");
    const prevPeriodKey = format(subMonths(now, 1), "yyyy-MM");

    // Current month operational cash flow
    const opCashFlowCurrent = computed.monthIncome - computed.monthExpense;
    const currentDRE = dreData.find(d => d.periodKey === currentPeriodKey);
    const prevDRE = dreData.find(d => d.periodKey === prevPeriodKey);

    let pq: number | null = null;
    if (currentDRE && currentDRE.lucroLiquido !== 0) {
      pq = (opCashFlowCurrent / currentDRE.lucroLiquido) * 100;
    }

    // Previous month: use prevMonthIncome/prevMonthExpense
    let pqPrev: number | null = null;
    if (prevDRE && prevDRE.lucroLiquido !== 0) {
      const prevOpCF = computed.prevMonthIncome - computed.prevMonthExpense;
      pqPrev = (prevOpCF / prevDRE.lucroLiquido) * 100;
    }

    // History for sparkline
    const history: Array<{ month: string; value: number }> = [];
    for (const d of dreData) {
      if (d.lucroLiquido !== 0) {
        // For months other than current, we'd need their transaction data
        // but we only have current+prev loaded. Use DRE only for history placeholder.
        // For simplicity, just show what we have from DRE as the quality indicator
        history.push({ month: d.periodKey, value: 0 }); // placeholder
      }
    }

    return { profitQuality: pq, profitQualityPrev: pqPrev, profitQualityHistory: history };
  }, [dreData, computed]);

  // Alerts
  const alerts = useMemo(() => {
    const list: HomeDashboardAlert[] = [];

    // 1) Fôlego baixo
    if (runwayDays !== null && runwayDays < 30) {
      list.push({
        id: "runway-low",
        title: "Fôlego baixo",
        description: `Fôlego de caixa: apenas ${runwayDays} dias restantes.`,
        priority: "high",
        iconName: "AlertTriangle",
      });
    }

    // 2) Concentração de despesas
    if (computed.topExpenseCategories.length > 0 && computed.topExpenseCategories[0].percent > 40) {
      list.push({
        id: "category-concentration",
        title: "Concentração de despesas",
        description: `A categoria "${computed.topExpenseCategories[0].name}" concentrou ${Math.round(computed.topExpenseCategories[0].percent)}% das despesas.`,
        priority: "medium",
        iconName: "Info",
      });
    }

    // 3) Queda de receita (>20% vs 30d anteriores)
    if (computed.prev30Income > 0 && computed.last30Income < computed.prev30Income * 0.8) {
      const pct = Math.round((1 - computed.last30Income / computed.prev30Income) * 100);
      list.push({
        id: "income-down",
        title: "Queda na receita",
        description: `Receita caiu ${pct}% nos últimos 30 dias vs período anterior.`,
        priority: "high",
        iconName: "TrendingDown",
      });
    }

    // 4) Despesas em alta (>10% vs mês anterior)
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

    return list.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }, [computed, invoices, runwayDays]);

  const isLoading = profileLoading || txLoading || prevTxLoading || invLoading || syncLoading || dreLoading;
  const hasData = (currTx?.length ?? 0) > 0;
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
    variationPercent,
    variationValue,
    runwayDays,
    topExpenseCategories: computed.topExpenseCategories,
    alerts,
    dailyTrend: computed.dailyTrend,
    healthScore,
    healthFactors,
    trendLabel,
    trendPercent,
    profitQuality,
    profitQualityPrev,
    profitQualityHistory,
    isLoading,
    hasData,
    hasSyncConnection,
  };
}
