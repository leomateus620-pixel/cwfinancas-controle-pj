import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SyncJob {
  id: string;
  user_id: string;
  connection_id: string;
  mode: string;
  status: "queued" | "running" | "success" | "failed" | "canceled" | "timeout";
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  progress: {
    tabs_total?: number;
    tabs_done?: number;
    rows_read?: number;
    rows_imported?: number;
    current_tab?: string;
  };
  error_message: string | null;
  error_step: string | null;
  request_id: string | null;
  created_at: string;
}

const STALE_HEARTBEAT_MINUTES = 5;

export function useSyncJobs(connectionId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const { data: jobs, isLoading, error, refetch } = useQuery({
    queryKey: ["sync-jobs", connectionId],
    queryFn: async () => {
      let query = supabase
        .from("sheet_sync_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (connectionId) {
        query = query.eq("connection_id", connectionId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Cast progress from Json to our typed interface
      return (data || []).map((job) => ({
        ...job,
        progress: (typeof job.progress === "object" && job.progress !== null ? job.progress : {}) as SyncJob["progress"],
      })) as SyncJob[];
    },
    enabled: !!session,
    staleTime: 2000,
    // Poll every 3s only when there's an active job
    refetchInterval: (query) => {
      const jobs = query.state.data as SyncJob[] | undefined;
      if (!jobs) return false;
      const hasActive = jobs.some(j => j.status === "queued" || j.status === "running");
      return hasActive ? 3000 : false;
    },
  });

  const activeJob = jobs?.find(j => j.status === "queued" || j.status === "running") || null;
  const lastJob = jobs?.[0] || null;

  // Detect stale job (heartbeat too old)
  const isJobStale = (() => {
    if (!activeJob?.heartbeat_at) return false;
    const age = Date.now() - new Date(activeJob.heartbeat_at).getTime();
    return age > STALE_HEARTBEAT_MINUTES * 60 * 1000;
  })();

  const hasActiveJob = !!activeJob && !isJobStale;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sync-jobs"] });
  };

  return {
    jobs: jobs || [],
    activeJob,
    lastJob,
    hasActiveJob,
    isJobStale,
    isLoading,
    error,
    refetch,
    invalidate,
  };
}
