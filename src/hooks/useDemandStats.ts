import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FinancialDemand } from "./useFinancialDemands";

export interface StatsFilters {
  from?: string;
  to?: string;
  type?: string | "all";
  priority?: string | "all";
  status?: string | "all";
}

export function useDemandStats(filters: StatsFilters = {}) {
  return useQuery({
    queryKey: ["demand-stats", filters],
    queryFn: async () => {
      let q = supabase.from("financial_demands").select("*").limit(1000);
      if (filters.from) q = q.gte("created_at", filters.from);
      if (filters.to) q = q.lte("created_at", filters.to);
      if (filters.type && filters.type !== "all") q = q.eq("demand_type", filters.type);
      if (filters.priority && filters.priority !== "all") q = q.eq("priority", filters.priority);
      if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as FinancialDemand[];

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const inMonth = rows.filter((r) => r.created_at >= monthStart);
      const pending = rows.filter((r) => r.status === "aguardando_aprovacao").length;

      const finalized = rows.filter((r) => r.status === "finalizada");
      const totalVolume = finalized
        .filter((r) => r.created_at >= monthStart)
        .reduce((s, r) => s + (r.amount ?? 0), 0);

      const resolvedDurations = finalized
        .map((r) => {
          const start = new Date(r.created_at).getTime();
          const end = new Date(r.updated_at).getTime();
          return (end - start) / (1000 * 60 * 60);
        })
        .filter((h) => h >= 0);
      const avgHours = resolvedDurations.length
        ? resolvedDurations.reduce((a, b) => a + b, 0) / resolvedDurations.length
        : 0;

      const byStatus: Record<string, number> = {};
      for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

      const byType: Record<string, number> = {};
      for (const r of rows) byType[r.demand_type] = (byType[r.demand_type] ?? 0) + 1;

      const openStatuses = new Set([
        "recebida","em_analise","aguardando_info","aguardando_aprovacao","aprovada","em_execucao","pagamento_agendado",
      ]);
      const oldestOpen = rows
        .filter((r) => openStatuses.has(r.status))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(0, 5);

      return {
        total: rows.length,
        inMonthCount: inMonth.length,
        pendingApprovals: pending,
        avgHours,
        totalVolume,
        byStatus,
        byType,
        oldestOpen,
      };
    },
    staleTime: 30_000,
  });
}
