import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SyncTabAudit {
  id: string;
  job_id: string | null;
  tab_name: string;
  period_key: string | null;
  rows_scanned: number;
  rows_with_value: number;
  rows_imported: number;
  rows_skipped: number;
  skip_reasons: Record<string, number>;
  errors: Array<{ row: number; error: string }>;
  created_at: string;
}

export function useSyncAudit(jobId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["sync-tab-audit", jobId],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from("sync_tab_audit")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (jobId) {
        query = query.eq("job_id", jobId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row) => ({
        ...row,
        skip_reasons: (typeof row.skip_reasons === "object" && row.skip_reasons !== null ? row.skip_reasons : {}) as Record<string, number>,
        errors: (Array.isArray(row.errors) ? row.errors : []) as Array<{ row: number; error: string }>,
      })) as SyncTabAudit[];
    },
    enabled: !!user?.id,
    staleTime: 5000,
  });
}
