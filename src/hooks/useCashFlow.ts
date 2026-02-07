import { useMemo } from "react";
import { useTransactions } from "./useTransactions";
import { format, startOfMonth, subMonths, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface CashFlowDataPoint {
  month: string;
  monthLabel: string;
  inflow: number;
  outflow: number;
  balance: number;
  cumulativeBalance: number;
  transactionCount: number;
}

export interface UpcomingPayment {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  type: "income" | "expense";
}

export function useCashFlow(months: number = 12) {
  const { transactions, isLoading, error } = useTransactions();

  const cashFlowData = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Group transactions by month
    const monthlyData = new Map<string, { inflow: number; outflow: number; count: number }>();
    
    // Initialize last N months
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = startOfMonth(subMonths(now, i));
      const monthKey = format(monthDate, "yyyy-MM");
      monthlyData.set(monthKey, { inflow: 0, outflow: 0, count: 0 });
    }

    // Aggregate transactions
    for (const tx of transactions) {
      if (!tx.date) continue;
      
      const txDate = parseISO(tx.date);
      if (!isValid(txDate)) continue;
      
      const monthKey = format(txDate, "yyyy-MM");
      
      // Only include if within our range
      if (!monthlyData.has(monthKey)) continue;
      
      const current = monthlyData.get(monthKey)!;
      const amount = Number(tx.amount) || 0;
      
      if (tx.type === "income") {
        current.inflow += amount;
      } else {
        current.outflow += amount;
      }
      current.count++;
    }

    // Convert to array and calculate cumulative balance
    const result: CashFlowDataPoint[] = [];
    let cumulativeBalance = 0;

    // Sort by month
    const sortedMonths = Array.from(monthlyData.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (const [monthKey, data] of sortedMonths) {
      const monthDate = parseISO(monthKey + "-01");
      const balance = data.inflow - data.outflow;
      cumulativeBalance += balance;

      result.push({
        month: monthKey,
        monthLabel: format(monthDate, "MMM", { locale: ptBR }),
        inflow: data.inflow,
        outflow: data.outflow,
        balance,
        cumulativeBalance,
        transactionCount: data.count,
      });
    }

    return result;
  }, [transactions, months]);

  // Get upcoming payments (future transactions)
  const upcomingPayments = useMemo((): UpcomingPayment[] => {
    if (!transactions) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return transactions
      .filter(tx => {
        if (!tx.date) return false;
        const txDate = parseISO(tx.date);
        return isValid(txDate) && txDate >= today;
      })
      .sort((a, b) => {
        const dateA = parseISO(a.date);
        const dateB = parseISO(b.date);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 10)
      .map(tx => ({
        id: tx.id,
        description: tx.description,
        amount: tx.type === "expense" ? -Number(tx.amount) : Number(tx.amount),
        dueDate: tx.date,
        type: tx.type as "income" | "expense",
      }));
  }, [transactions]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalInflow = cashFlowData.reduce((sum, d) => sum + d.inflow, 0);
    const totalOutflow = cashFlowData.reduce((sum, d) => sum + d.outflow, 0);
    const netCashFlow = totalInflow - totalOutflow;
    
    // Calculate trend (comparing last month to previous)
    const lastMonth = cashFlowData[cashFlowData.length - 1];
    const prevMonth = cashFlowData[cashFlowData.length - 2];
    
    let trend = 0;
    if (lastMonth && prevMonth && prevMonth.balance !== 0) {
      trend = ((lastMonth.balance - prevMonth.balance) / Math.abs(prevMonth.balance)) * 100;
    }

    return {
      totalInflow,
      totalOutflow,
      netCashFlow,
      trend,
      currentBalance: cashFlowData.length > 0 ? cashFlowData[cashFlowData.length - 1].cumulativeBalance : 0,
    };
  }, [cashFlowData]);

  return {
    cashFlowData,
    upcomingPayments,
    totals,
    isLoading,
    error,
    hasData: cashFlowData.length > 0 && cashFlowData.some(d => d.transactionCount > 0),
  };
}
