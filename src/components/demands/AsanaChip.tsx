import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Clock, MinusCircle, Circle } from "lucide-react";
import type { AsanaSyncStatus } from "@/hooks/useDemandsInbox";

interface Props {
  status: AsanaSyncStatus;
  url: string | null;
  taskId?: string | null;
  errorMessage?: string | null;
  lastSyncedAt?: string | null;
  isInternal?: boolean;
  size?: "xs" | "sm";
}

const MAP: Record<AsanaSyncStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  not_synced: { label: "Não sincronizado", cls: "bg-slate-100 text-slate-600 border-slate-200", Icon: Circle },
  pending_sync: { label: "Aguardando sync", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: Clock },
  syncing: { label: "Sincronizando", cls: "bg-blue-50 text-blue-700 border-blue-200", Icon: Loader2 },
  synced: { label: "Asana OK", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
  error: { label: "Erro Asana", cls: "bg-rose-50 text-rose-700 border-rose-200", Icon: AlertTriangle },
  disabled: { label: "Desativado", cls: "bg-slate-50 text-slate-500 border-slate-200", Icon: MinusCircle },
};

function fmtRelative(iso?: string | null) {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export function AsanaChip({
  status, url, taskId, errorMessage, lastSyncedAt, isInternal, size = "xs",
}: Props) {
  const cfg = MAP[status] ?? MAP.not_synced;
  const Icon = cfg.Icon;
  const textSize = size === "sm" ? "text-xs" : "text-[10px]";

  const chip = (
    <Badge variant="outline" className={cn(cfg.cls, textSize, "font-medium gap-1 cursor-help")}>
      <Icon className={cn("w-3 h-3", status === "syncing" && "animate-spin")} />
      {cfg.label}
      {url && status === "synced" && <ExternalLink className="w-2.5 h-2.5" />}
    </Badge>
  );

  const wrapped = url && status === "synced" ? (
    <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{chip}</a>
  ) : chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild><span>{wrapped}</span></TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-xs">
        <div className="space-y-0.5">
          <div className="font-semibold">{cfg.label}</div>
          <div>Última sync: {fmtRelative(lastSyncedAt)}</div>
          {taskId && <div className="font-mono text-[10px] opacity-70">ID: {taskId.slice(0, 12)}…</div>}
          {isInternal && errorMessage && (
            <div className="text-rose-300 text-[11px] mt-1 break-words">{errorMessage}</div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
