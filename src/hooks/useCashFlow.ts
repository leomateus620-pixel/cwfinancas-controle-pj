import { useMemo } from "react";
import { useTransactions } from "./useTransactions";
import { format, startOfMonth, subMonths, parseISO, isValid, differenceInMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDateRange } from "@/contexts/DateRangeContext";

export interface CashFlowDataPoint {
  month: string;
  monthLabel: string;
  inflow: number;
  outflow: number;
  balance: number;
  cumulativeBalance: number;
  transactionCount: number;
  transferIn: number;
  transferOut: number;
}

export interface UpcomingPayment {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  type: "income" | "expense";
}

export function useCashFlow() {
  const { transactions, isLoading, error } = useTransactions({ includeTransfers: true });

  let globalRange: { from: Date; to: Date } | null = null;
  try {
    const dr = useDateRange();
    globalRange = dr.range;
  } catch {
    // fallback
  }

  const rangeFrom = globalRange?.from || subMonths(new Date(), 12);
  const rangeTo = globalRange?.to || new Date();

  const cashFlowData = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Group transactions by month within the global range
    const monthlyData = new Map<string, { inflow: number; outflow: number; count: number; transferIn: number; transferOut: number }>();
    
    // Initialize months within range
    const totalMonths = differenceInMonths(rangeTo, rangeFrom) + 1;
    for (let i = 0; i < totalMonths; i++) {
      const monthDate = startOfMonth(addMonths(rangeFrom, i));
      const monthKey = format(monthDate, "yyyy-MM");
      monthlyData.set(monthKey, { inflow: 0, outflow: 0, count: 0, transferIn: 0, transferOut: 0 });
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
      const movementType = (tx as any).movement_type || (tx.type === "income" ? "INCOME" : "EXPENSE");
      
      if (movementType === "TRANSFER") {
        if (tx.type === "income") {
          current.transferIn += amount;
        } else {
          current.transferOut += amount;
        }
      } else if (tx.type === "income") {
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
        transferIn: data.transferIn,
        transferOut: data.transferOut,
      });
    }

    return result;
  }, [transactions, rangeFrom, rangeTo]);

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

  const totals = useMemo(() => {
    // Calculate trend from chart data (comparing last month to previous)
    const lastMonth = cashFlowData[cashFlowData.length - 1];
    const prevMonth = cashFlowData[cashFlowData.length - 2];
    
    let trend = 0;
    if (lastMonth && prevMonth && prevMonth.balance !== 0) {
      trend = ((lastMonth.balance - prevMonth.balance) / Math.abs(prevMonth.balance)) * 100;
    }

    // Calculate totals directly from chart data (already aggregated)
    const totalInflow = cashFlowData.reduce((sum, d) => sum + d.inflow, 0);
    const totalOutflow = cashFlowData.reduce((sum, d) => sum + d.outflow, 0);
    const netCashFlow = totalInflow - totalOutflow;
    const totalTransferIn = cashFlowData.reduce((sum, d) => sum + d.transferIn, 0);
    const totalTransferOut = cashFlowData.reduce((sum, d) => sum + d.transferOut, 0);

    return {
      totalInflow,
      totalOutflow,
      netCashFlow,
      trend,
      currentBalance: cashFlowData.length > 0 ? cashFlowData[cashFlowData.length - 1].cumulativeBalance : 0,
      totalTransferIn,
      totalTransferOut,
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
