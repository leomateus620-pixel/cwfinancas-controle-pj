import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SyncRun {
  id: string;
  connection_id: string;
  spreadsheet_name?: string;
  sheet_name?: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "error";
  mode: "MANUAL" | "SCHEDULED" | "PUSH";
  rows_read: number;
  rows_upserted: number;
  rows_updated: number;
  rows_failed: number;
  errors: Array<{ row?: number; error?: string; message?: string }>;
  google_revision?: string;
}

interface SyncStats {
  total_syncs: number;
  successful_syncs: number;
  partial_syncs: number;
  failed_syncs: number;
  total_rows_imported: number;
  total_rows_upserted: number;
}

interface ConnectionInfo {
  id: string;
  spreadsheet_name: string;
  sheet_name: string | null;
  sync_status: string;
  last_sync_at: string | null;
  auto_sync_enabled: boolean;
  auto_sync_interval: number;
}

interface SyncStatusResponse {
  runs: SyncRun[];
  connections: ConnectionInfo[];
  stats: SyncStats;
}

export function useSyncStatus(connectionId?: string) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<SyncStatusResponse>({
    queryKey: ["sync-status", connectionId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sheets-sync-status", {
        body: connectionId ? { connection_id: connectionId, limit: 20 } : { limit: 20 },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as SyncStatusResponse;
    },
    enabled: !!session,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });

  // Mutation to toggle auto-sync
  const toggleAutoSync = useMutation({
    mutationFn: async ({ connectionId, enabled }: { connectionId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("google_sheet_connections")
        .update({ auto_sync_enabled: enabled })
        .eq("id", connectionId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
      toast({
        title: variables.enabled ? "Auto-sync ativado" : "Auto-sync desativado",
        description: variables.enabled 
          ? "A planilha será sincronizada automaticamente." 
          : "A sincronização automática foi desativada.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar configuração",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Mutation to update sync interval
  const updateSyncInterval = useMutation({
    mutationFn: async ({ connectionId, interval }: { connectionId: string; interval: number }) => {
      const { error } = await supabase
        .from("google_sheet_connections")
        .update({ auto_sync_interval: interval })
        .eq("id", connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
      toast({
        title: "Intervalo atualizado",
        description: "O intervalo de sincronização foi atualizado.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar intervalo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  return {
    runs: data?.runs ?? [],
    connections: data?.connections ?? [],
    stats: data?.stats ?? {
      total_syncs: 0,
      successful_syncs: 0,
      partial_syncs: 0,
      failed_syncs: 0,
      total_rows_imported: 0,
      total_rows_upserted: 0,
    },
    isLoading,
    error,
    refetch,
    toggleAutoSync,
    updateSyncInterval,
  };
}
