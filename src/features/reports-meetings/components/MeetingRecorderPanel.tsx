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

export function MeetingRecorderPanel({
  status,
  start,
  pause,
  resume,
  finish,
  error,
}: MeetingRecorderPanelProps) {
  return (
    <div className="liquid-glass space-y-3 rounded-2xl p-4 md:p-5">
      <div>
        <div className="text-base font-semibold">Modo reunião</div>
        <div className="text-sm text-muted-foreground">Status: {status}</div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={start} disabled={status === "recording" || status === "finishing"}>
          Iniciar reunião
        </Button>

        <Button
          variant="outline"
          onClick={status === "paused" ? resume : pause}
          disabled={status === "idle" || status === "blocked" || status === "finishing"}
        >
          {status === "paused" ? "Retomar" : "Pausar"}
        </Button>

        <Button
          variant="destructive"
          onClick={finish}
          disabled={status === "idle" || status === "blocked" || status === "finishing"}
        >
          {status === "finishing" ? "Finalizando..." : "Finalizar reunião"}
        </Button>
      </div>
    </div>
  );
}
