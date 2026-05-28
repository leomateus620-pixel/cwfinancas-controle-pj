import { useState } from "react";
import { Cloud, Trash2, RefreshCcw, ChevronDown, ChevronUp, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import {
  useMeetingsLibrary,
  useMeetingDetail,
  useDeleteMeeting,
  useRegenerateSummary,
  type MeetingLibraryItem,
} from "../hooks/useMeetingsLibrary";

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function MarkdownLite({ text }: { text: string }) {
  // Minimal renderer: ## headings, - bullets, **bold**
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (lines[0]?.startsWith("## ")) {
          return (
            <div key={bi}>
              <h4 className="mb-1 text-sm font-semibold tracking-tight text-foreground">
                {lines[0].replace(/^##\s*/, "")}
              </h4>
              <div className="space-y-1">
                {lines.slice(1).map((l, i) =>
                  l.trim().startsWith("- ") ? (
                    <div key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span dangerouslySetInnerHTML={{ __html: l.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
                    </div>
                  ) : (
                    <p key={i} dangerouslySetInnerHTML={{ __html: l.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
                  ),
                )}
              </div>
            </div>
          );
        }
        return (
          <p
            key={bi}
            className="whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: block.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }}
          />
        );
      })}
    </div>
  );
}

function MeetingRow({ meeting }: { meeting: MeetingLibraryItem }) {
  const [open, setOpen] = useState(false);
  const detailQ = useMeetingDetail(open ? meeting.id : null);
  const delMut = useDeleteMeeting();
  const regenMut = useRegenerateSummary();

  const hasSummary = Boolean(meeting.summary_generated_at);
  const isFinished = meeting.status === "finished";

  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur-sm transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{meeting.title}</span>
            {hasSummary ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                <Sparkles className="h-3 w-3" /> Resumo IA
              </span>
            ) : isFinished ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600">
                Sem resumo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {meeting.status}
              </span>
            )}
            {meeting.audio_purged_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600">
                <Cloud className="h-3 w-3" /> Áudio descartado
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <span>{formatDate(meeting.started_at)}</span>
            <span>•</span>
            <span>{formatDuration(meeting.duration_seconds)}</span>
          </div>
          {meeting.description && (
            <p className="mt-2 text-sm leading-snug text-foreground/80 line-clamp-2">
              {meeting.description}
            </p>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {isFinished && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={hasSummary ? "Gerar resumo novamente" : "Gerar resumo"}
              onClick={() => regenMut.mutate(meeting.id)}
              disabled={regenMut.isPending}
            >
              {regenMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Excluir reunião"
            onClick={() => {
              if (confirm("Excluir esta reunião? Esta ação é definitiva.")) delMut.mutate(meeting.id);
            }}
            disabled={delMut.isPending}
          >
            {delMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-border/40 pt-4">
          {detailQ.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando resumo...
            </div>
          )}
          {detailQ.isError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Não foi possível carregar o resumo.
            </div>
          )}
          {detailQ.data && (
            <>
              {detailQ.data.summary_markdown ? (
                <MarkdownLite text={detailQ.data.summary_markdown} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Resumo ainda não foi gerado. Use o botão de regenerar acima.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MeetingsHistoryPanel() {
  const { data, isLoading, isError, error, refetch, isFetching } = useMeetingsLibrary();

  return (
    <GlassCard className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Histórico de reuniões na nuvem
          </h3>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando reuniões salvas...
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Falha ao listar reuniões</p>
            <p className="text-xs opacity-80">{(error as Error)?.message ?? "Erro desconhecido"}</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && (data?.length ?? 0) === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma reunião salva ainda. Grave uma reunião para vê-la aqui — o áudio é processado e descartado, apenas descrição e resumo ficam armazenados.
        </div>
      )}

      {!isLoading && !isError && (data?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {data!.map((m) => (
            <MeetingRow key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </GlassCard>
  );
}
