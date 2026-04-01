import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface AnnualGoal {
  id: string;
  user_id: string;
  connection_id: string | null;
  year: number;
  meta_receita_anual: number | null;
  meta_despesa_anual: number | null;
  meta_lucro_anual: number | null;
  created_at: string;
  updated_at: string;
}

export function useAnnualGoals(connectionId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const { data: goals, isLoading } = useQuery({
    queryKey: ["annual-goals", user?.id, connectionId],
    queryFn: async () => {
      if (!user?.id || !connectionId) return [];
      const { data, error } = await supabase
        .from("company_annual_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("connection_id", connectionId)
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnnualGoal[];
    },
    enabled: !!user?.id && !!connectionId,
  });

  const currentYearGoal = goals?.find(g => g.year === currentYear) ?? null;

  const upsertGoal = useMutation({
    mutationFn: async (input: {
      year: number;
      meta_receita_anual?: number | null;
      meta_despesa_anual?: number | null;
      meta_lucro_anual?: number | null;
    }) => {
      if (!user?.id || !connectionId) throw new Error("Contexto inválido");

      const existing = goals?.find(g => g.year === input.year);
      if (existing) {
        const { data, error } = await supabase
          .from("company_annual_goals")
          .update({
            meta_receita_anual: input.meta_receita_anual,
            meta_despesa_anual: input.meta_despesa_anual,
            meta_lucro_anual: input.meta_lucro_anual,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("company_annual_goals")
          .insert({
            user_id: user.id,
            connection_id: connectionId,
            year: input.year,
            meta_receita_anual: input.meta_receita_anual,
            meta_despesa_anual: input.meta_despesa_anual,
            meta_lucro_anual: input.meta_lucro_anual,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["annual-goals", user?.id, connectionId] });
      toast({ title: "Meta anual salva", description: "Meta anual atualizada com sucesso." });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Erro ao salvar meta", description: e.message });
    },
  });

  return { goals: goals ?? [], currentYearGoal, isLoading, upsertGoal };
}
