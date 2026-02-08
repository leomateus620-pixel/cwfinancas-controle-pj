import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface TransactionFlag {
  id: string;
  transaction_id: string;
  needs_review: boolean;
  reasons: string[];
  confidence: number;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
}

export interface FlaggedTransaction {
  id: string;
  date: string;
  description: string;
  category: string;
  type: string;
  amount: number;
  client_vendor: string | null;
  flags: TransactionFlag;
}

export function useFlaggedTransactions() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: flaggedTransactions,
    isLoading,
    error,
    refetch,
  } = useQuery<FlaggedTransaction[]>({
    queryKey: ["flagged-transactions"],
    queryFn: async () => {
      // First get transactions with flags
      const { data: flags, error: flagsError } = await supabase
        .from("transaction_flags")
        .select("*")
        .eq("needs_review", true);

      if (flagsError) throw flagsError;
      if (!flags || flags.length === 0) return [];

      const transactionIds = flags.map(f => f.transaction_id);

      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .in("id", transactionIds)
        .order("date", { ascending: false });

      if (txError) throw txError;

      // Combine transactions with their flags
      return (transactions || []).map(tx => ({
        ...tx,
        flags: flags.find(f => f.transaction_id === tx.id)!,
      })) as FlaggedTransaction[];
    },
    enabled: !!session?.user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const markReviewedMutation = useMutation({
    mutationFn: async ({ transactionId, notes }: { transactionId: string; notes?: string }) => {
      const { error } = await supabase
        .from("transaction_flags")
        .update({
          needs_review: false,
          reviewed_at: new Date().toISOString(),
          reviewed_by: session?.user?.id,
          notes,
        })
        .eq("transaction_id", transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-transactions"] });
      toast({
        title: "Item revisado",
        description: "A transação foi marcada como revisada.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao marcar como revisado",
        variant: "destructive",
      });
    },
  });

  const dismissFlagMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase
        .from("transaction_flags")
        .delete()
        .eq("transaction_id", transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-transactions"] });
      toast({
        title: "Flag removida",
        description: "A marcação foi removida da transação.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao remover flag",
        variant: "destructive",
      });
    },
  });

  const reviewCount = flaggedTransactions?.length || 0;

  return {
    flaggedTransactions: flaggedTransactions || [],
    reviewCount,
    isLoading,
    error,
    refetch,
    markReviewed: markReviewedMutation.mutate,
    dismissFlag: dismissFlagMutation.mutate,
    isMarkingReviewed: markReviewedMutation.isPending,
    isDismissing: dismissFlagMutation.isPending,
  };
}

export function useDataQuality() {
  const { flaggedTransactions, reviewCount, isLoading } = useFlaggedTransactions();

  // Get total transactions count
  const { data: totalCount } = useQuery({
    queryKey: ["transactions-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return count || 0;
    },
  });

  const coveragePercent = totalCount
    ? Math.round(((totalCount - reviewCount) / totalCount) * 100 * 10) / 10
    : 100;

  return {
    coveragePercent,
    needsReviewCount: reviewCount,
    totalCount: totalCount || 0,
    isLoading,
    reasonsBreakdown: flaggedTransactions.reduce((acc, tx) => {
      tx.flags.reasons.forEach(reason => {
        acc[reason] = (acc[reason] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>),
  };
}
