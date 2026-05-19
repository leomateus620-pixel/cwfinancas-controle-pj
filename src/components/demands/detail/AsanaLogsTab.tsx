import { useState } from "react";
import { useAsanaSyncLogs } from "@/hooks/useAsanaSyncLogs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FileSearch, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AsanaLogsTab({ demandId }: { demandId: string }) {
  const { data, isLoading } = useAsanaSyncLogs(demandId);

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-10">
        <FileSearch className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum log de sincronização encontrado para esta demanda.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {data.map((log) => <LogRow key={log.id} log={log} />)}
    </ul>
  );
}

function LogRow({ log }: { log: ReturnType<typeof useAsanaSyncLogs>["data"] extends Array<infer T> | undefined ? T : never }) {
  const [open, setOpen] = useState(false);
  const ok = log.status === "success" || log.status === "ok";

  return (
    <li className={cn(
      "rounded-xl border bg-white/50 backdrop-blur-sm",
      ok ? "border-emerald-200/60" : "border-rose-200/60",
    )}>
      <div className="flex items-center gap-3 px-3 py-2">
        {ok
          ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{log.action}</span>
            <Badge variant="outline" className={cn("text-[10px]", ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200")}>
              {log.status}
            </Badge>
          </div>
          {log.error_message && <div className="text-xs text-rose-600 truncate mt-0.5">{log.error_message}</div>}
          <div className="text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</div>
        </div>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            {open ? "Ocultar" : "Ver payload"} <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
        </Collapsible>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <PayloadBlock label="Request" value={log.request_payload} />
          <PayloadBlock label="Response" value={log.response_payload} />
        </div>
      )}
    </li>
  );
}

function PayloadBlock({ label, value }: { label: string; value: unknown }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <pre className="text-[11px] bg-slate-50 border border-slate-200/60 rounded-lg p-2 overflow-x-auto max-h-48 font-mono">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
