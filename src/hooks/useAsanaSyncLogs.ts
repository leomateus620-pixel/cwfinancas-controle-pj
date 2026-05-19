import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AsanaSyncLog {
  id: string;
  demand_id: string | null;
  action: string;
  status: string;
  request_payload: unknown;
  response_payload: unknown;
  error_message: string | null;
  created_at: string;
}

export function useAsanaSyncLogs(demandId: string | undefined, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["asana-sync-logs", demandId],
    enabled: !!demandId && opts.enabled !== false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asana_sync_logs")
        .select("*")
        .eq("demand_id", demandId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as AsanaSyncLog[];
    },
    staleTime: 15_000,
  });
}

export function useAllAsanaSyncLogs(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["asana-sync-logs", "all"],
    enabled: opts.enabled !== false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asana_sync_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as AsanaSyncLog[];
    },
    staleTime: 30_000,
  });
}
