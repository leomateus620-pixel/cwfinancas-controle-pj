import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DemandStatus =
  | "recebida" | "em_analise" | "aguardando_info" | "aguardando_aprovacao"
  | "aprovada" | "reprovada" | "em_execucao" | "pagamento_agendado"
  | "comprovante_enviado" | "finalizada" | "cancelada";

export type DemandPriority = "baixa" | "normal" | "alta" | "urgente";

export type AsanaSyncStatusValue =
  | "not_synced" | "pending_sync" | "syncing" | "synced" | "error" | "disabled";

export interface FinancialDemand {
  id: string;
  demand_code: string | null;
  created_by: string;
  assigned_to: string | null;
  company_id: string | null;
  demand_type: string;
  title: string;
  description: string | null;
  amount: number | null;
  due_date: string | null;
  sla_due_at: string | null;
  supplier_name: string | null;
  supplier_document: string | null;
  category_suggested: string | null;
  category_final: string | null;
  cost_center: string | null;
  rejection_reason: string | null;
  priority: DemandPriority;
  status: DemandStatus;
  requires_review: boolean;
  asana_task_id: string | null;
  asana_task_url: string | null;
  asana_sync_status: AsanaSyncStatusValue;
  asana_sync_error: string | null;
  asana_last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Filters {
  search?: string;
  status?: DemandStatus | "all";
  priority?: DemandPriority | "all";
}

export function useFinancialDemands(filters: Filters = {}) {
  return useQuery({
    queryKey: ["financial-demands", filters],
    queryFn: async () => {
      let q = supabase
        .from("financial_demands")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (filters.priority && filters.priority !== "all") q = q.eq("priority", filters.priority);
      if (filters.search?.trim()) q = q.ilike("title", `%${filters.search.trim()}%`);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as FinancialDemand[];
    },
    staleTime: 30_000,
  });
}
