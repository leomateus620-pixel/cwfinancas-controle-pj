import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChecklistItem {
  id: string;
  demand_id: string;
  label: string;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

export function useDemandChecklist(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-checklist", demandId],
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_demand_checklist")
        .select("*")
        .eq("demand_id", demandId!)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ChecklistItem[];
    },
    staleTime: 10_000,
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, demandId, next }: { id: string; demandId: string; next: boolean }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const { error } = await supabase
        .from("financial_demand_checklist")
        .update({
          is_completed: next,
          completed_by: next ? uid : null,
          completed_at: next ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["demand-checklist", vars.demandId] });
    },
  });
}
