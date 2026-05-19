import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { DemandStatus } from "./useFinancialDemands";

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["demands-inbox"] });
  qc.invalidateQueries({ queryKey: ["demands-inbox-stats"] });
  qc.invalidateQueries({ queryKey: ["financial-demands"] });
  qc.invalidateQueries({ queryKey: ["pending-approvals-count"] });
}

export function useDemandQuickActions() {
  const qc = useQueryClient();

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DemandStatus }) => {
      const patch: Record<string, unknown> = { status };
      if (status === "finalizada") patch.finalized_at = new Date().toISOString();
      const { error } = await supabase.from("financial_demands").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      // Fire-and-forget Asana update (silenciado em caso de falha)
      supabase.functions.invoke("asana-update-task", { body: { demand_id: id } }).catch(() => {});
    },
    onSuccess: () => {
      invalidate(qc);
      toast({ title: "Status atualizado" });
    },
    onError: (e) => toast({ title: "Erro ao atualizar status", description: String(e instanceof Error ? e.message : e), variant: "destructive" }),
  });

  const markUrgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_demands").update({ priority: "urgente" }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { invalidate(qc); toast({ title: "Marcada como urgente" }); },
  });

  const finalize = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_demands")
        .update({ status: "finalizada", finalized_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { invalidate(qc); toast({ title: "Demanda finalizada" }); },
  });

  const retryAsana = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_demands")
        .update({ asana_sync_status: "pending_sync", asana_sync_error: null }).eq("id", id);
      if (error) throw new Error(error.message);
      await supabase.functions.invoke("asana-create-task", { body: { demand_id: id } }).catch(() => {});
    },
    onSuccess: () => { invalidate(qc); toast({ title: "Reenvio ao Asana solicitado" }); },
  });

  const retryAllAsana = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("asana-retry-sync", { body: {} });
      if (error) throw new Error(error.message);
      return data as { processed?: number; success?: number; errors?: number };
    },
    onSuccess: (r) => {
      invalidate(qc);
      toast({
        title: "Sincronização Asana executada",
        description: `${r?.success ?? 0} OK · ${r?.errors ?? 0} erro(s) · ${r?.processed ?? 0} processadas`,
      });
    },
    onError: (e) => toast({ title: "Falha ao sincronizar", description: String(e instanceof Error ? e.message : e), variant: "destructive" }),
  });

  return { changeStatus, markUrgent, finalize, retryAsana, retryAllAsana };
}

