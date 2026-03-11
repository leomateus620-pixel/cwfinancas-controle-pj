import { useMemo } from "react";
import { usePeriodMetrics } from "./usePeriodMetrics";
import { useTransactions, Transaction } from "./useTransactions";

export interface OverviewData {
  // From usePeriodMetrics
  currentBalance: number;
  balanceChange: number;
  transferIn: number;
  transferOut: number;
  isLoading: boolean;
  // Transactions for charts (operational only, from date range)
  transactions: Transaction[];
  recentTransactions: Transaction[];
}

export function useOverviewData(): OverviewData {
  const metrics = usePeriodMetrics();
  const { transactions, isLoading: txLoading } = useTransactions({ excludeTransfers: true });

  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5);
  }, [transactions]);

  return {
    currentBalance: metrics.currentBalance,
    balanceChange: metrics.balanceChange,
    transferIn: metrics.transferIn,
    transferOut: metrics.transferOut,
    isLoading: metrics.isLoading || txLoading,
    transactions,
    recentTransactions,
  };
}
