import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

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
}

export function useBankBalances(periodKey?: string): UseBankBalancesResult {
  const { session } = useAuth();
  const currentPeriodKey = periodKey || format(new Date(), "yyyy-MM");

  const { data, isLoading } = useQuery({
    queryKey: ["bank-balances", currentPeriodKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_balances" as any)
        .select("*")
        .eq("period_key", currentPeriodKey)
        .order("bank_name");

      if (error) {
        console.error("Error fetching bank balances:", error);
        return [];
      }
      return (data || []) as unknown as BankBalanceRow[];
    },
    enabled: !!session,
  });

  const rows = data || [];
  const hasValues = rows.length > 0;

  const openingTotal = hasValues
    ? rows.reduce((sum, r) => sum + (r.opening_balance ?? 0), 0)
    : null;
  const closingTotal = hasValues
    ? rows.reduce((sum, r) => sum + (r.closing_balance ?? 0), 0)
    : null;

  return {
    rows,
    openingTotal,
    closingTotal,
    isLoading,
    isEmpty: !isLoading && rows.length === 0,
    periodKey: currentPeriodKey,
  };
}
