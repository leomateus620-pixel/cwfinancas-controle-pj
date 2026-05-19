import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DemandPriority, DemandStatus } from "./useFinancialDemands";

export type AsanaSyncStatus =
  | "not_synced" | "pending_sync" | "syncing" | "synced" | "error" | "disabled";

export interface InboxDemand {
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
  priority: DemandPriority;
  status: DemandStatus;
  asana_task_id: string | null;
  asana_task_url: string | null;
  asana_sync_status: AsanaSyncStatus;
  asana_sync_error: string | null;
  asana_last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InboxQuickFilter =
  | "all" | "today" | "open" | "urgent" | "waiting_client" | "waiting_approval"
  | "overdue" | "due_soon" | "asana_ok" | "asana_error";

export interface InboxFilters {
  search?: string;
  status?: DemandStatus | "all";
  priority?: DemandPriority | "all";
  type?: string | "all";
  syncStatus?: AsanaSyncStatus | "all";
  quick?: InboxQuickFilter;
}

const OPEN_STATUSES: DemandStatus[] = [
  "recebida", "em_analise", "aguardando_info", "aguardando_aprovacao",
  "aprovada", "em_execucao", "pagamento_agendado", "comprovante_enviado",
];

const PAGE_SIZE = 50;

function startOfTodayISO() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
}
function isoPlusDays(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}
function todayDateISO() {
  return new Date().toISOString().slice(0, 10);
}

function applyFilters(qBase: ReturnType<typeof supabase.from>, filters: InboxFilters) {
  // Using `any` to chain typed query builder fluently without explosion.
  // The filters call results are all part of PostgrestFilterBuilder.
   
  let q: any = qBase
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.priority && filters.priority !== "all") q = q.eq("priority", filters.priority);
  if (filters.type && filters.type !== "all") q = q.eq("demand_type", filters.type);
  if (filters.syncStatus && filters.syncStatus !== "all") q = q.eq("asana_sync_status", filters.syncStatus);
  if (filters.search?.trim()) {
    const s = filters.search.trim();
    q = q.or(`title.ilike.%${s}%,demand_code.ilike.%${s}%,supplier_name.ilike.%${s}%`);
  }

  switch (filters.quick) {
    case "today": q = q.gte("created_at", startOfTodayISO()); break;
    case "open": q = q.in("status", OPEN_STATUSES); break;
    case "urgent": q = q.eq("priority", "urgente"); break;
    case "waiting_client": q = q.eq("status", "aguardando_info"); break;
    case "waiting_approval": q = q.eq("status", "aguardando_aprovacao"); break;
    case "overdue":
      q = q.in("status", OPEN_STATUSES).lt("due_date", todayDateISO()); break;
    case "due_soon":
      q = q.in("status", OPEN_STATUSES).gte("due_date", todayDateISO()).lte("due_date", isoPlusDays(3)); break;
    case "asana_ok": q = q.eq("asana_sync_status", "synced"); break;
    case "asana_error": q = q.eq("asana_sync_status", "error"); break;
    default: break;
  }
  return q;
}

/**
 * Paginated inbox loader (50 itens/página, infinite scroll).
 */
export function useDemandsInboxInfinite(filters: InboxFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["demands-inbox-infinite", filters],
    initialPageParam: 0,
    staleTime: 20_000,
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const q = applyFilters(supabase.from("financial_demands"), filters).range(from, to);
      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      return {
        rows: (data ?? []) as InboxDemand[],
        page,
        total: count ?? 0,
        hasMore: ((data ?? []).length === PAGE_SIZE) && (count == null || to + 1 < count),
      };
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

/**
 * Compat wrapper — retorna interface idêntica ao hook antigo (data = array flat).
 * Mantemos para não quebrar consumidores existentes. Para "carregar mais",
 * preferir useDemandsInboxInfinite diretamente.
 */
export function useDemandsInbox(filters: InboxFilters = {}) {
  const inf = useDemandsInboxInfinite(filters);
  const flat = useMemo<InboxDemand[] | undefined>(() => {
    if (!inf.data) return undefined;
    return inf.data.pages.flatMap((p) => p.rows);
  }, [inf.data]);
  const total = inf.data?.pages[0]?.total ?? 0;

  return {
    data: flat,
    total,
    isLoading: inf.isLoading,
    isFetching: inf.isFetching,
    error: inf.error,
    refetch: inf.refetch,
    hasNextPage: inf.hasNextPage,
    isFetchingNextPage: inf.isFetchingNextPage,
    fetchNextPage: inf.fetchNextPage,
  };
}

export function useDemandsInboxStats() {
  return useQuery({
    queryKey: ["demands-inbox-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_demands")
        .select("id,status,priority,due_date,created_at,updated_at,asana_sync_status,asana_last_synced_at,finalized_at")
        .limit(2000);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<Pick<InboxDemand, "id" | "status" | "priority" | "due_date" | "created_at" | "updated_at" | "asana_sync_status" | "asana_last_synced_at"> & { finalized_at: string | null }>;

      const todayStart = startOfTodayISO();
      const today = todayDateISO();
      const in3 = isoPlusDays(3);
      const open = rows.filter((r) => OPEN_STATUSES.includes(r.status as DemandStatus));

      const finalized = rows.filter((r) => r.status === "finalizada" && r.finalized_at);
      const avgHours = finalized.length
        ? finalized.reduce((s, r) => s + (new Date(r.finalized_at!).getTime() - new Date(r.created_at).getTime()) / 3600000, 0) / finalized.length
        : 0;

      const lastAsanaSync = rows
        .map((r) => r.asana_last_synced_at)
        .filter(Boolean)
        .sort()
        .pop() ?? null;

      return {
        today: rows.filter((r) => r.created_at >= todayStart).length,
        open: open.length,
        urgent: open.filter((r) => r.priority === "urgente").length,
        waitingClient: open.filter((r) => r.status === "aguardando_info").length,
        waitingApproval: open.filter((r) => r.status === "aguardando_aprovacao").length,
        overdue: open.filter((r) => r.due_date && r.due_date < today).length,
        dueSoon: open.filter((r) => r.due_date && r.due_date >= today && r.due_date <= in3).length,
        asanaOk: rows.filter((r) => r.asana_sync_status === "synced").length,
        asanaError: rows.filter((r) => r.asana_sync_status === "error").length,
        avgHours,
        lastAsanaSync,
      };
    },
    staleTime: 30_000,
  });
}

export function useUniqueDemandTypes(rows: InboxDemand[] | undefined) {
  return useMemo(() => {
    if (!rows) return [];
    return Array.from(new Set(rows.map((r) => r.demand_type))).sort();
  }, [rows]);
}
