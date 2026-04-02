import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveConnection } from "@/hooks/useActiveConnection";
import { toast } from "sonner";

export function useCreditCardDashboard() {
  const { user } = useAuth();
  const { connectionId } = useActiveConnection();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const cyclesQuery = useQuery({
    queryKey: ["cc-cycles", userId, connectionId],
    queryFn: async () => {
      if (!userId || !connectionId) return [];
      const { data, error } = await supabase
        .from("credit_card_cycles")
        .select("*")
        .eq("user_id", userId)
        .eq("connection_id", connectionId)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!connectionId,
  });

  const transactionsQuery = useQuery({
    queryKey: ["cc-transactions", userId, connectionId],
    queryFn: async () => {
      if (!userId || !connectionId) return [];
      const cycleIds = (cyclesQuery.data || []).map((c: any) => c.id);
      if (cycleIds.length === 0) return [];
      const { data, error } = await supabase
        .from("credit_card_transactions")
        .select("*")
        .eq("user_id", userId)
        .in("cycle_id", cycleIds)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!connectionId && !!cyclesQuery.data,
  });

  const reviewQuery = useQuery({
    queryKey: ["cc-review", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("credit_card_review_queue")
        .select("*")
        .eq("user_id", userId)
        .is("final_decision", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const detectMutation = useMutation({
    mutationFn: async () => {
      if (!connectionId) throw new Error("Nenhuma planilha conectada");
      const { data, error } = await supabase.functions.invoke("detect-credit-cards", {
        body: { connectionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cc-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["cc-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cc-review"] });
      toast.success(
        `Detecção concluída: ${data.cycles} faturas, ${data.transactions} lançamentos`
      );
    },
    onError: (err: any) => {
      toast.error("Erro na detecção: " + (err.message || "Erro desconhecido"));
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: string }) => {
      const { error } = await supabase
        .from("credit_card_review_queue")
        .update({
          final_decision: decision,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cc-review"] });
      toast.success("Revisão salva");
    },
  });

  // Computed aggregates
  const cycles = cyclesQuery.data || [];
  const transactions = transactionsQuery.data || [];
  const reviewItems = reviewQuery.data || [];

  const kpis = {
    grossAmount: cycles.reduce((s: number, c: any) => s + Number(c.gross_amount || 0), 0),
    reimbursementAmount: cycles.reduce((s: number, c: any) => s + Number(c.reimbursement_amount || 0), 0),
    netAmount: cycles.reduce((s: number, c: any) => s + Number(c.net_amount || 0), 0),
    transactionCount: transactions.length,
    cycleCount: cycles.length,
    reviewCount: reviewItems.length,
  };

  // Category breakdown
  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const t of transactions) {
    const cat = (t as any).category_original || "Sem categoria";
    const existing = categoryMap.get(cat) || { total: 0, count: 0 };
    existing.total += Math.abs(Number((t as any).amount || 0));
    existing.count++;
    categoryMap.set(cat, existing);
  }
  const categories = Array.from(categoryMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);

  return {
    cycles,
    transactions,
    reviewItems,
    kpis,
    categories,
    isLoading: cyclesQuery.isLoading || transactionsQuery.isLoading,
    isDetecting: detectMutation.isPending,
    detect: detectMutation.mutate,
    reviewItem: reviewMutation.mutate,
    connectionId,
  };
}
