import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function invalidate(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ["demand", id] });
  qc.invalidateQueries({ queryKey: ["demand-timeline", id] });
  qc.invalidateQueries({ queryKey: ["financial-demands"] });
  qc.invalidateQueries({ queryKey: ["demands-pending-count"] });
}

export function useRequestApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_demands")
        .update({ status: "aguardando_aprovacao" })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, id) => invalidate(qc, id),
  });
}

export function useApproveDemand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const { error } = await supabase
        .from("financial_demands")
        .update({
          status: "aprovada",
          approved_at: new Date().toISOString(),
          approved_by: uid,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, id) => invalidate(qc, id),
  });
}

export function useRejectDemand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const trimmed = reason.trim();
      if (trimmed.length < 5) throw new Error("Justifique com pelo menos 5 caracteres.");
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const { error } = await supabase
        .from("financial_demands")
        .update({
          status: "reprovada",
          rejected_at: new Date().toISOString(),
          rejected_by: uid,
          rejection_reason: trimmed,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => invalidate(qc, vars.id),
  });
}

export function useSetDemandCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase
        .from("financial_demands")
        .update({ category_final: category })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => invalidate(qc, vars.id),
  });
}
