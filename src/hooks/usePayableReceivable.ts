import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface APRRecord {
  id: string;
  record_type: "payable" | "receivable";
  period_key: string;
  source_tab: string;
  source_row: number | null;
  source_layout: string | null;
  due_date: string | null;
  description: string;
  counterpart: string | null;
  nf_number: string | null;
  payment_method: string | null;
  amount: number;
  status_raw: string | null;
  status_normalized: string;
  notes: string | null;
  created_at: string;
}

export interface APRAggregates {
  total: number;
  totalSettled: number;
  totalPending: number;
  count: number;
}

function computeAggregates(records: APRRecord[], settledStatuses: string[]): APRAggregates {
  let total = 0;
  let totalSettled = 0;
  let totalPending = 0;

  for (const r of records) {
    total += r.amount;
    if (settledStatuses.includes(r.status_normalized)) {
      totalSettled += r.amount;
    } else if (r.status_normalized === "pendente") {
      totalPending += r.amount;
    }
  }

  return { total, totalSettled, totalPending, count: records.length };
}

export function usePayableReceivable(periodKey: string) {
  const { user } = useAuth();

  const payableQuery = useQuery({
    queryKey: ["apr-payable", periodKey, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("accounts_payable_receivable")
        .select("*")
        .eq("user_id", user.id)
        .eq("record_type", "payable")
        .eq("period_key", periodKey)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as APRRecord[];
    },
    enabled: !!user?.id && !!periodKey,
  });

  const receivableQuery = useQuery({
    queryKey: ["apr-receivable", periodKey, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("accounts_payable_receivable")
        .select("*")
        .eq("user_id", user.id)
        .eq("record_type", "receivable")
        .eq("period_key", periodKey)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as APRRecord[];
    },
    enabled: !!user?.id && !!periodKey,
  });

  const payableAggregates = computeAggregates(payableQuery.data || [], ["pago"]);
  const receivableAggregates = computeAggregates(receivableQuery.data || [], ["recebido"]);

  return {
    payable: payableQuery.data || [],
    receivable: receivableQuery.data || [],
    payableAggregates,
    receivableAggregates,
    isLoading: payableQuery.isLoading || receivableQuery.isLoading,
    error: payableQuery.error || receivableQuery.error,
  };
}
