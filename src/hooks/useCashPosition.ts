import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface CashPositionPeriod {
  period: string;        // "2025-12"
  label: string;         // "Dez/25"
  totalBalance: number;  // sum of closing_balance
  accounts: Record<string, number | null>;
}

export interface UseCashPositionResult {
  positionHistory: CashPositionPeriod[];
  accountNames: string[];
  isLoading: boolean;
  isEmpty: boolean;
}

function normalizeBankName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function periodToLabel(periodKey: string): string {
  try {
    const d = parse(periodKey, "yyyy-MM", new Date());
    const label = format(d, "MMM/yy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return periodKey;
  }
}

export function useCashPosition(): UseCashPositionResult {
  const { session } = useAuth();

  const { data: rawRows, isLoading } = useQuery({
    queryKey: ["cash-position-all", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_balances")
        .select("id, bank_name, closing_balance, opening_balance, period_key")
        .order("period_key", { ascending: true })
        .order("bank_name");

      if (error) {
        console.error("Error fetching all bank balances:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!session?.user?.id,
    staleTime: 120_000,
  });

  const { positionHistory, accountNames } = useMemo(() => {
    if (!rawRows || rawRows.length === 0) {
      return { positionHistory: [], accountNames: [] };
    }

    // Deduplicate by normalized bank_name + period_key (keep latest)
    const deduped = new Map<string, { bank_name: string; period_key: string; closing_balance: number }>();
    for (const row of rawRows) {
      const name = normalizeBankName(row.bank_name);
      const balance = typeof row.closing_balance === "number" && !isNaN(row.closing_balance)
        ? row.closing_balance
        : 0;
      const key = `${name}::${row.period_key}`;
      deduped.set(key, { bank_name: name, period_key: row.period_key, closing_balance: balance });
    }

    // Collect unique accounts and periods
    const accountSet = new Set<string>();
    const periodMap = new Map<string, Map<string, number>>();

    for (const entry of deduped.values()) {
      accountSet.add(entry.bank_name);
      if (!periodMap.has(entry.period_key)) {
        periodMap.set(entry.period_key, new Map());
      }
      periodMap.get(entry.period_key)!.set(entry.bank_name, entry.closing_balance);
    }

    const sortedAccounts = Array.from(accountSet).sort();
    const sortedPeriods = Array.from(periodMap.keys()).sort();

    const history: CashPositionPeriod[] = sortedPeriods.map(period => {
      const accountBalances = periodMap.get(period)!;
      const accounts: Record<string, number | null> = {};
      let total = 0;

      for (const acctName of sortedAccounts) {
        const bal = accountBalances.get(acctName);
        if (bal !== undefined) {
          accounts[acctName] = bal;
          total += bal;
        } else {
          accounts[acctName] = null; // account absent this period
        }
      }

      return {
        period,
        label: periodToLabel(period),
        totalBalance: total,
        accounts,
      };
    });

    return { positionHistory: history, accountNames: sortedAccounts };
  }, [rawRows]);

  return {
    positionHistory,
    accountNames,
    isLoading,
    isEmpty: !isLoading && positionHistory.length === 0,
  };
}
