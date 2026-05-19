import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FinancialDemand } from "./useFinancialDemands";

export function useDemand(id: string | undefined) {
  return useQuery({
    queryKey: ["demand", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_demands")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as FinancialDemand | null;
    },
    staleTime: 15_000,
  });
}

export interface CreateDemandInput {
  demand_type: string;
  title: string;
  priority: string;
  amount?: number | null;
  due_date?: string | null;
  supplier_name?: string | null;
  supplier_document?: string | null;
  cost_center?: string | null;
  description?: string | null;
}

export function useCreateDemand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDemandInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Você precisa estar autenticado.");

      const { data, error } = await supabase
        .from("financial_demands")
        .insert({ ...input, created_by: uid, asana_sync_status: "pending_sync" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const demandId = data.id as string;

      // Fire-and-forget — não bloqueia UI, não quebra se Asana falhar
      void import("@/lib/asana/invokeAsana").then(({ invokeAsana }) =>
        invokeAsana("asana-create-task", { demand_id: demandId }),
      );

      return demandId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-demands"] });
      qc.invalidateQueries({ queryKey: ["demands-inbox"] });
      qc.invalidateQueries({ queryKey: ["demands-inbox-stats"] });
    },
  });
}


export function useUpdateDemandStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("financial_demands")
        .update({ status })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["demand", vars.id] });
      qc.invalidateQueries({ queryKey: ["demand-timeline", vars.id] });
      qc.invalidateQueries({ queryKey: ["financial-demands"] });
    },
  });
}
