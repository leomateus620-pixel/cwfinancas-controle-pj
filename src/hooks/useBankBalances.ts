import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subMonths } from "date-fns";

export interface BankBalanceRow {
  id: string;
  bank_name: string;
  opening_balance: number | null;
  closing_balance: number | null;
  period_key: string;
  tab_name: string | null;
}

export interface UseBankBalancesResult {
  rows: BankBalanceRow[];
  openingTotal: number | null;
  closingTotal: number | null;
  isLoading: boolean;
  isEmpty: boolean;
  periodKey: string;
  previousRows: BankBalanceRow[];
  previousClosingTotal: number | null;
}

function getPreviousPeriodKey(periodKey: string): string {
  const [y, m] = periodKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const prev = subMonths(d, 1);
  return format(prev, "yyyy-MM");
}

export function useBankBalances(periodKey?: string): UseBankBalancesResult {
  const { session } = useAuth();
  const currentPeriodKey = periodKey || format(new Date(), "yyyy-MM");
  const prevPeriodKey = getPreviousPeriodKey(currentPeriodKey);

  const { data, isLoading } = useQuery({
    queryKey: ["bank-balances", currentPeriodKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_balances")
        .select("*")
        .eq("period_key", currentPeriodKey)
        .order("bank_name");

      if (error) {
        console.error("Error fetching bank balances:", error);
        return [];
      }
      return (data || []) as BankBalanceRow[];
    },
    enabled: !!session,
  });

  const { data: prevData } = useQuery({
    queryKey: ["bank-balances", prevPeriodKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_balances")
        .select("*")
        .eq("period_key", prevPeriodKey)
        .order("bank_name");

      if (error) return [];
      return (data || []) as BankBalanceRow[];
    },
    enabled: !!session,
  });

  const rows = data || [];
  const previousRows = prevData || [];
  const hasValues = rows.length > 0;

  const openingTotal = hasValues
    ? rows.reduce((sum, r) => sum + (r.opening_balance ?? 0), 0)
    : null;
  const closingTotal = hasValues
    ? rows.reduce((sum, r) => sum + (r.closing_balance ?? 0), 0)
    : null;
  const previousClosingTotal = previousRows.length > 0
    ? previousRows.reduce((sum, r) => sum + (r.closing_balance ?? 0), 0)
    : null;

  return {
    rows,
    openingTotal,
    closingTotal,
    isLoading,
    isEmpty: !isLoading && rows.length === 0,
    periodKey: currentPeriodKey,
    previousRows,
    previousClosingTotal,
  };
}

/** Fetch all distinct period_keys the user has bank balances for */
export function useAllBankBalancePeriods(): { periods: string[]; isLoading: boolean } {
  const { session } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["bank-balance-periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_balances")
        .select("period_key");

      if (error) {
        console.error("Error fetching bank balance periods:", error);
        return [];
      }
      const unique = [...new Set((data || []).map((r: any) => r.period_key as string))];
      return unique.sort();
    },
    enabled: !!session,
  });

  return { periods: data || [], isLoading };
}
