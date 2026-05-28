import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink, Info } from "lucide-react";

interface MeetingRecorderPanelProps {
  status: string;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  error?: string | null;
  demoMode?: boolean;
  publicUrl?: string;
}

const STATUS_LABELS: Record<string, string> = {
  idle: "Pronto para iniciar",
  recording: "Gravando",
  paused: "Pausado",
  finishing: "Finalizando…",
  blocked: "Bloqueado",
};

export function MeetingRecorderPanel({
  status,
  start,
  pause,
  resume,
  finish,
  error,
  demoMode,
  publicUrl,
}: MeetingRecorderPanelProps) {
  const canPauseResume = status === "recording" || status === "paused";
  const canFinish = status === "recording" || status === "paused";
  const startLabel = status === "blocked" ? "Tentar novamente" : "Iniciar reunião";

  return (
    <div className="liquid-glass rounded-2xl p-4 md:p-5 space-y-3">
      <div>
        <div className="text-base font-semibold">Modo reunião</div>
        <div className="text-sm text-muted-foreground">
          Status: {STATUS_LABELS[status] ?? status}
        </div>
      </div>

      {demoMode && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="space-y-1">
            <div>
              Microfone indisponível no preview. Gravação rodando em <strong>modo demonstração</strong>.
            </div>
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                Abrir em nova aba para gravar áudio real
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={start} disabled={status === "recording" || status === "paused" || status === "finishing"}>
          {startLabel}
        </Button>
        <Button
          variant="outline"
          onClick={status === "paused" ? resume : pause}
          disabled={!canPauseResume}
        >
          {status === "paused" ? "Retomar" : "Pausar"}
        </Button>
        <Button variant="destructive" onClick={finish} disabled={!canFinish}>
          Finalizar reunião
        </Button>
      </div>
    </div>
  );
}
