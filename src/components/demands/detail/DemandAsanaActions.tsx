import { Button } from "@/components/ui/button";
import { useDemandQuickActions } from "@/hooks/useDemandQuickActions";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Cloud, ExternalLink, RefreshCw, Link2, FileSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AsanaSyncStatus } from "@/hooks/useDemandsInbox";

interface Props {
  demandId: string;
  taskId: string | null;
  taskUrl: string | null;
  syncStatus: AsanaSyncStatus;
  isInternal: boolean;
  onShowLogs?: () => void;
}

export function DemandAsanaActions({
  demandId, taskId, taskUrl, syncStatus, isInternal, onShowLogs,
}: Props) {
  const qc = useQueryClient();
  const { retryAsana } = useDemandQuickActions();

  const syncNow = useMutation({
    mutationFn: async () => {
      const fn = taskId ? "asana-update-task" : "asana-create-task";
      const { data, error } = await supabase.functions.invoke(fn, { body: { demand_id: demandId } });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demand", demandId] });
      qc.invalidateQueries({ queryKey: ["asana-sync-logs", demandId] });
      qc.invalidateQueries({ queryKey: ["demand-timeline", demandId] });
      qc.invalidateQueries({ queryKey: ["demands-inbox-infinite"] });
      toast.success("Sincronização Asana executada");
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Falha na sincronização";
      toast.error(isInternal ? msg : "Não foi possível sincronizar com o Asana agora");
    },
  });

  const copyLink = () => {
    if (!taskUrl) return;
    navigator.clipboard.writeText(taskUrl).then(
      () => toast.success("Link do Asana copiado"),
      () => toast.error("Não foi possível copiar"),
    );
  };

  const canRetry = ["error", "pending_sync", "not_synced"].includes(syncStatus);
  const busy = syncNow.isPending || retryAsana.isPending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {taskUrl && (
        <Button asChild variant="outline" size="sm" className="rounded-xl gap-2 bg-white/50 backdrop-blur-sm">
          <a href={taskUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="w-3.5 h-3.5" />Abrir no Asana
          </a>
        </Button>
      )}
      {taskUrl && (
        <Button variant="outline" size="sm" className="rounded-xl gap-2 bg-white/50 backdrop-blur-sm" onClick={copyLink}>
          <Link2 className="w-3.5 h-3.5" />Copiar link
        </Button>
      )}
      {isInternal && (
        <Button
          variant="outline" size="sm"
          className="rounded-xl gap-2 bg-white/50 backdrop-blur-sm"
          onClick={() => syncNow.mutate()}
          disabled={busy}
        >
          {syncNow.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
          Sincronizar agora
        </Button>
      )}
      {isInternal && canRetry && (
        <Button
          variant="outline" size="sm"
          className="rounded-xl gap-2 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
          onClick={() => retryAsana.mutate(demandId)}
          disabled={busy}
        >
          {retryAsana.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Reenviar Asana
        </Button>
      )}
      {isInternal && onShowLogs && (
        <Button variant="ghost" size="sm" className="rounded-xl gap-2 text-muted-foreground" onClick={onShowLogs}>
          <FileSearch className="w-3.5 h-3.5" />Ver logs
        </Button>
      )}
    </div>
  );
}
