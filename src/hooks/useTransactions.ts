import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Transaction {
  id: string;
  user_id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  category: string;
  date: string;
  client_vendor: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionInput = Omit<Transaction, "id" | "user_id" | "created_at" | "updated_at">;

export function useTransactions(filters?: {
  type?: "income" | "expense";
  startDate?: string;
  endDate?: string;
  category?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transactions, isLoading, error } = useQuery({
    queryKey: ["transactions", user?.id, filters],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false });

      if (filters?.type) {
        query = query.eq("type", filters.type);
      }
      if (filters?.startDate) {
        query = query.gte("date", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("date", filters.endDate);
      }
      if (filters?.category) {
        query = query.eq("category", filters.category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user?.id,
  });

  const createTransaction = useMutation({
    mutationFn: async (input: TransactionInput) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("transactions")
        .insert({
          ...input,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: "Transação criada",
        description: "A transação foi adicionada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar transação",
        description: error.message,
      });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...input }: Partial<TransactionInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("transactions")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: "Transação atualizada",
        description: "A transação foi atualizada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar transação",
        description: error.message,
      });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: "Transação excluída",
        description: "A transação foi removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir transação",
        description: error.message,
      });
    },
  });

  // Calculate totals
  const incomeTotal = transactions?.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;
  const expenseTotal = transactions?.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;
  
  const totals = {
    income: incomeTotal,
    expense: expenseTotal,
    balance: incomeTotal - expenseTotal,
  };

  return {
    transactions: transactions ?? [],
    isLoading,
    error,
    totals,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
