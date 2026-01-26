import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  client_name: string;
  value: number;
  issue_date: string;
  due_date: string;
  status: "paid" | "pending" | "overdue";
  created_at: string;
  updated_at: string;
}

export type InvoiceInput = Omit<Invoice, "id" | "user_id" | "created_at" | "updated_at">;

export function useInvoices(filters?: {
  status?: "paid" | "pending" | "overdue";
  startDate?: string;
  endDate?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ["invoices", user?.id, filters],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from("invoices")
        .select("*")
        .order("issue_date", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.startDate) {
        query = query.gte("issue_date", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("issue_date", filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!user?.id,
  });

  const createInvoice = useMutation({
    mutationFn: async (input: InvoiceInput) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("invoices")
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
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Nota fiscal criada",
        description: "A nota fiscal foi adicionada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar nota fiscal",
        description: error.message,
      });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...input }: Partial<InvoiceInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("invoices")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Nota fiscal atualizada",
        description: "A nota fiscal foi atualizada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar nota fiscal",
        description: error.message,
      });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Nota fiscal excluída",
        description: "A nota fiscal foi removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir nota fiscal",
        description: error.message,
      });
    },
  });

  // Calculate summary
  const summary = {
    total: invoices?.length ?? 0,
    paid: invoices?.filter(i => i.status === "paid").length ?? 0,
    pending: invoices?.filter(i => i.status === "pending").length ?? 0,
    overdue: invoices?.filter(i => i.status === "overdue").length ?? 0,
    totalValue: invoices?.reduce((sum, i) => sum + Number(i.value), 0) ?? 0,
    paidValue: invoices?.filter(i => i.status === "paid").reduce((sum, i) => sum + Number(i.value), 0) ?? 0,
    pendingValue: invoices?.filter(i => i.status === "pending").reduce((sum, i) => sum + Number(i.value), 0) ?? 0,
  };

  return {
    invoices: invoices ?? [],
    isLoading,
    error,
    summary,
    createInvoice,
    updateInvoice,
    deleteInvoice,
  };
}
