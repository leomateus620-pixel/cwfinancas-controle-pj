import { Button } from "@/components/ui/button";

export function MeetingRecorderPanel({
  status,
  start,
  pause,
  resume,
  finish,
  error,
}: {
  status: string;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  error?: string | null;
}) {
  return (
    <div className="liquid-glass rounded-2xl p-4 md:p-5 space-y-3">
      <div>
        <div className="text-base font-semibold">Modo reunião</div>
        <div className="text-sm text-muted-foreground">Status: {status}</div>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={start} disabled={status === "recording"}>Iniciar reunião</Button>
        <Button variant="outline" onClick={status === "paused" ? resume : pause} disabled={status === "idle" || status === "blocked"}>
          {status === "paused" ? "Retomar" : "Pausar"}
        </Button>
        <Button variant="destructive" onClick={finish} disabled={status === "idle" || status === "blocked"}>Finalizar reunião</Button>
      </div>
    </div>
  );
}
