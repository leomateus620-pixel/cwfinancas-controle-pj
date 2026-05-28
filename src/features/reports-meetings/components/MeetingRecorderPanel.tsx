import { Button } from "@/components/ui/button";
import type { MeetingStatus } from "../hooks/useMeetingRecorder";

interface MeetingRecorderPanelProps {
  status: MeetingStatus;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  error?: string | null;
}

const statusLabel: Record<MeetingStatus, string> = {
  idle: "Pronto para iniciar",
  recording: "Gravando/acompanhando",
  paused: "Pausado",
  finishing: "Finalizando",
  blocked: "Bloqueado",
};

export function MeetingRecorderPanel({
  status,
  start,
  pause,
  resume,
  finish,
  error,
}: MeetingRecorderPanelProps) {
  const isRunning = status === "recording";
  const isPaused = status === "paused";
  const isFinishing = status === "finishing";
  const canFinish = isRunning || isPaused;

  return (
    <div className="liquid-glass space-y-3 rounded-2xl p-4 md:p-5">
      <div>
        <div className="text-base font-semibold">Modo reunião</div>
        <div className="text-sm text-muted-foreground">Status: {statusLabel[status]}</div>
      </div>

      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={start} disabled={isRunning || isFinishing}>
          {isPaused ? "Reiniciar reunião" : "Iniciar reunião"}
        </Button>

        <Button variant="outline" onClick={isPaused ? resume : pause} disabled={status === "idle" || status === "blocked" || isFinishing}>
          {isPaused ? "Retomar" : "Pausar"}
        </Button>

        <Button variant="destructive" onClick={finish} disabled={!canFinish || isFinishing}>
          {isFinishing ? "Finalizando..." : "Finalizar reunião"}
        </Button>
      </div>
    </div>
  );
}
