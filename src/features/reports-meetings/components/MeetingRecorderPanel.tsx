import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import type { MeetingStatus } from "../hooks/useMeetingRecorder";

interface MeetingRecorderPanelProps {
  status: MeetingStatus;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  error?: string | null;
  isSpeechSupported: boolean;
  persistenceMode?: "edge" | "database" | "local" | null;
}

const STATUS_LABELS: Record<MeetingStatus, string> = { idle: "Pronto para iniciar", recording: "Gravando/acompanhando", paused: "Pausado", finishing: "Finalizando…", blocked: "Bloqueado" };

export function MeetingRecorderPanel({ status, start, pause, resume, finish, error, isSpeechSupported, persistenceMode }: MeetingRecorderPanelProps) {
  const isRecording = status === "recording";
  const isPaused = status === "paused";
  const isFinishing = status === "finishing";
  return (
    <div className="liquid-glass space-y-3 rounded-2xl p-4 md:p-5">
      <div><div className="text-base font-semibold">Modo reunião</div><div className="text-sm text-muted-foreground">Status: {STATUS_LABELS[status] ?? status}</div></div>
      {!isSpeechSupported && <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">Transcrição automática indisponível. Grave a reunião ou cole a transcrição manualmente.</div>}
      {persistenceMode === "local" && <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-sm text-sky-800">Modo acompanhamento: sessão em fallback local.</div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={start} disabled={isRecording || isPaused || isFinishing}>{status === "blocked" ? "Tentar novamente" : "Iniciar reunião"}</Button>
        <Button variant="outline" onClick={isPaused ? resume : pause} disabled={!(isRecording || isPaused) || isFinishing}>{isPaused ? "Retomar" : "Pausar"}</Button>
        <Button variant="destructive" onClick={finish} disabled={!(isRecording || isPaused) || isFinishing}>{isFinishing ? "Finalizando..." : "Finalizar reunião"}</Button>
      </div>
    </div>
  );
}
