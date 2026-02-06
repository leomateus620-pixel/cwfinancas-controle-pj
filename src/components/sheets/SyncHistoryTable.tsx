import { CheckCircle, AlertCircle, Clock, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface SyncHistoryTableProps {
  runs: SyncRun[];
  isLoading?: boolean;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (start: string, end: string | null) => {
  if (!end) return "Em andamento...";
  const duration = new Date(end).getTime() - new Date(start).getTime();
  if (duration < 1000) return "< 1s";
  if (duration < 60000) return `${Math.round(duration / 1000)}s`;
  return `${Math.round(duration / 60000)}min`;
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case "success":
      return { icon: CheckCircle, color: "text-success", bg: "bg-success/10", label: "Sucesso" };
    case "partial":
      return { icon: AlertCircle, color: "text-warning", bg: "bg-warning/10", label: "Parcial" };
    case "error":
      return { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Erro" };
    case "running":
      return { icon: Loader2, color: "text-primary", bg: "bg-primary/10", label: "Executando" };
    default:
      return { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: "Pendente" };
  }
};

const getModeLabel = (mode: string) => {
  switch (mode) {
    case "MANUAL": return "Manual";
    case "SCHEDULED": return "Agendado";
    case "PUSH": return "Automático";
    default: return mode;
  }
};

export function SyncHistoryTable({ runs, isLoading }: SyncHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Nenhuma sincronização realizada ainda.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Data/Hora</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Modo</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Lidas</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Importadas</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Erros</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Duração</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const statusConfig = getStatusConfig(run.status);
            const StatusIcon = statusConfig.icon;

            return (
              <tr 
                key={run.id} 
                className="border-b border-border/30 hover:bg-muted/50 transition-colors"
              >
                <td className="py-3 px-2">
                  <span className="text-foreground">{formatDate(run.started_at)}</span>
                </td>
                <td className="py-3 px-2">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                    statusConfig.bg, statusConfig.color
                  )}>
                    <StatusIcon className={cn("w-3.5 h-3.5", run.status === "running" && "animate-spin")} />
                    {statusConfig.label}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <span className="text-muted-foreground">{getModeLabel(run.mode)}</span>
                </td>
                <td className="py-3 px-2 text-right tabular-nums">
                  {run.rows_read}
                </td>
                <td className="py-3 px-2 text-right tabular-nums text-success">
                  {run.rows_upserted}
                </td>
                <td className="py-3 px-2 text-right tabular-nums">
                  {run.rows_failed > 0 ? (
                    <span className="text-destructive">{run.rows_failed}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="py-3 px-2 text-right text-muted-foreground">
                  {formatDuration(run.started_at, run.finished_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
