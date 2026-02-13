import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { format, differenceInDays, subDays, parseISO } from "date-fns";
import { useMemo } from "react";

interface CategoryEntry {
  name: string;
  value: number;
  percent: number;
}

interface MonthlyEntry {
  monthKey: string;
  income: number;
  expense: number;
  balance: number;
}

interface DREReconciliation {
  monthKey: string;
  txIncome: number;
  txExpense: number;
  txResult: number;
  dreIncome: number | null;
  dreExpense: number | null;
  dreResult: number | null;
  diffPercent: number | null;
  status: "ok" | "warning" | "no_dre";
}

export interface PeriodMetrics {
  currentIncome: number;
  currentExpense: number;
  currentBalance: number;
  previousIncome: number;
  previousExpense: number;
  previousBalance: number;
  incomeChange: number;
  expenseChange: number;
  balanceChange: number;
  margin: number;
  marginChange: number;
  monthlyBreakdown: MonthlyEntry[];
  categoryBreakdown: { income: CategoryEntry[]; expense: CategoryEntry[] };
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    type: string;
    date: string;
    category: string;
    client_vendor: string | null;
  }>;
  transactionCount: number;
  reconciliation: DREReconciliation[];
  hasReconciliationWarnings: boolean;
  isLoading: boolean;
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function usePeriodMetrics(): PeriodMetrics {
  const { user } = useAuth();
  const { range } = useDateRange();

  const fromStr = format(range.from, "yyyy-MM-dd");
  const toStr = format(range.to, "yyyy-MM-dd");

  const diffDays = differenceInDays(range.to, range.from) + 1;
  const previousTo = subDays(range.from, 1);
  const previousFrom = subDays(range.from, diffDays);
  const prevFromStr = format(previousFrom, "yyyy-MM-dd");
  const prevToStr = format(previousTo, "yyyy-MM-dd");

  // Current period transactions
  const { data: currentTx, isLoading: loadingCurrent } = useQuery({
    queryKey: ["period-metrics-current", user?.id, fromStr, toStr],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("id, type, description, amount, category, date, client_vendor")
        .gte("date", fromStr)
        .lte("date", toStr)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Previous period transactions
  const { data: previousTx, isLoading: loadingPrevious } = useQuery({
    queryKey: ["period-metrics-previous", user?.id, prevFromStr, prevToStr],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("type, amount")
        .gte("date", prevFromStr)
        .lte("date", prevToStr);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // DRE data for reconciliation
  const { data: drePeriods } = useQuery({
    queryKey: ["period-metrics-dre", user?.id, fromStr, toStr],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: periods, error: pErr } = await supabase
        .from("dre_periods")
        .select("id, period_key");
      if (pErr) throw pErr;
      if (!periods || periods.length === 0) return [];

      const periodIds = periods.map(p => p.id);
      const { data: lines, error: lErr } = await supabase
        .from("dre_lines")
        .select("period_id, line_label, value, is_group, group_label")
        .in("period_id", periodIds);
      if (lErr) throw lErr;

      return periods.map(p => ({
        periodKey: p.period_key,
        lines: (lines ?? []).filter(l => l.period_id === p.id),
      }));
    },
    enabled: !!user?.id,
  });

  return useMemo(() => {
    const txs = currentTx ?? [];
    const prevTxs = previousTx ?? [];

    // Current period
    const currentIncome = txs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const currentExpense = txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const currentBalance = currentIncome - currentExpense;

    // Previous period
    const previousIncome = prevTxs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const previousExpense = prevTxs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const previousBalance = previousIncome - previousExpense;

    // Changes
    const incomeChange = calcChange(currentIncome, previousIncome);
    const expenseChange = calcChange(currentExpense, previousExpense);
    const balanceChange = calcChange(currentBalance, previousBalance);

    // Margin
    const margin = currentIncome > 0 ? (currentBalance / currentIncome) * 100 : 0;
    const prevMargin = previousIncome > 0 ? (previousBalance / previousIncome) * 100 : 0;
    const marginChange = prevMargin !== 0 ? margin - prevMargin : 0;

    // Monthly breakdown
    const monthMap = new Map<string, { income: number; expense: number }>();
    txs.forEach(t => {
      const mk = t.date.substring(0, 7); // YYYY-MM from date string
      const entry = monthMap.get(mk) || { income: 0, expense: 0 };
      if (t.type === "income") entry.income += Number(t.amount);
      else entry.expense += Number(t.amount);
      monthMap.set(mk, entry);
    });
    const monthlyBreakdown: MonthlyEntry[] = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, v]) => ({
        monthKey,
        income: v.income,
        expense: v.expense,
        balance: v.income - v.expense,
      }));

    // Category breakdown
    const incCatMap = new Map<string, number>();
    const expCatMap = new Map<string, number>();
    txs.forEach(t => {
      const map = t.type === "income" ? incCatMap : expCatMap;
      map.set(t.category, (map.get(t.category) || 0) + Number(t.amount));
    });

    const toTop5 = (map: Map<string, number>, total: number): CategoryEntry[] =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value, percent: total > 0 ? (value / total) * 100 : 0 }));

    const categoryBreakdown = {
      income: toTop5(incCatMap, currentIncome),
      expense: toTop5(expCatMap, currentExpense),
    };

    // Recent transactions
    const recentTransactions = txs.slice(0, 10).map(t => ({
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
      date: t.date,
      category: t.category,
      client_vendor: t.client_vendor,
    }));

    // DRE Reconciliation
    const reconciliation: DREReconciliation[] = monthlyBreakdown.map(mb => {
      const dreMonth = drePeriods?.find(dp => dp.periodKey === mb.monthKey);
      if (!dreMonth || dreMonth.lines.length === 0) {
        return {
          monthKey: mb.monthKey,
          txIncome: mb.income,
          txExpense: mb.expense,
          txResult: mb.balance,
          dreIncome: null,
          dreExpense: null,
          dreResult: null,
          diffPercent: null,
          status: "no_dre" as const,
        };
      }

      // Extract DRE totals from lines
      const lines = dreMonth.lines.filter(l => !l.is_group);
      let dreIncome = 0;
      let dreExpense = 0;
      lines.forEach(l => {
        const label = (l.line_label || "").toLowerCase();
        const group = (l.group_label || "").toLowerCase();
        if (group.includes("receita") || label.includes("receita")) {
          dreIncome += Math.abs(Number(l.value));
        } else if (group.includes("despesa") || group.includes("custo") || label.includes("despesa") || label.includes("custo")) {
          dreExpense += Math.abs(Number(l.value));
        }
      });
      const dreResult = dreIncome - dreExpense;
      const diffPercent = mb.balance !== 0 ? Math.abs((mb.balance - dreResult) / Math.abs(mb.balance)) * 100 : 0;

      return {
        monthKey: mb.monthKey,
        txIncome: mb.income,
        txExpense: mb.expense,
        txResult: mb.balance,
        dreIncome,
        dreExpense,
        dreResult,
        diffPercent,
        status: diffPercent > 15 ? "warning" as const : "ok" as const,
      };
    });

    const hasReconciliationWarnings = reconciliation.some(r => r.status === "warning");

    return {
      currentIncome,
      currentExpense,
      currentBalance,
      previousIncome,
      previousExpense,
      previousBalance,
      incomeChange,
      expenseChange,
      balanceChange,
      margin,
      marginChange,
      monthlyBreakdown,
      categoryBreakdown,
      recentTransactions,
      transactionCount: txs.length,
      reconciliation,
      hasReconciliationWarnings,
      isLoading: loadingCurrent || loadingPrevious,
    };
  }, [currentTx, previousTx, drePeriods, loadingCurrent, loadingPrevious]);
}
