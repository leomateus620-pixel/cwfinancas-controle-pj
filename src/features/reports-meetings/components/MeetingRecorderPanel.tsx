import { AlertTriangle, CheckCircle2, CircleDot, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MeetingStatus } from "../hooks/useMeetingRecorder";
import type { OperationalEvent, TopicSummary } from "../lib/meetingRecorderUtils";

interface MeetingRecorderPanelProps {
  status: MeetingStatus;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: (reason?: string) => Promise<void>;
  error?: string | null;
  isSpeechSupported: boolean;
  persistenceMode?: "database" | "local" | null;
  hasBackendSession?: boolean;
  durationMs: number;
  autosaveState: string;
  recognitionRestarted: boolean;
  recognitionUnstable: boolean;
  finalizationStage: string;
  operationalStatus: TopicSummary["operationalStatus"];
  operationalEvents: OperationalEvent[];
}

const fmt = (ms: number) => new Date(ms).toISOString().slice(11, 19);

export function MeetingRecorderPanel(p: MeetingRecorderPanelProps) {
  const isRecording = p.status === "recording";
  const isPaused = p.status === "paused";
  const isFinishing = p.status === "finishing";
  const transcriptionStatus = !p.isSpeechSupported
    ? "fallback manual"
    : p.recognitionUnstable
    ? "instavel"
    : p.recognitionRestarted
    ? "reiniciada"
    : "ativa";
  const statusIcon =
    p.operationalStatus === "stable" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    ) : p.operationalStatus === "fallback" ? (
      <AlertTriangle className="h-4 w-4 text-amber-600" />
    ) : (
      <CircleDot className="h-4 w-4 text-blue-600" />
    );

  return (
    <div className="liquid-glass space-y-3 rounded-2xl p-4 md:p-5">
      <div>
        <div className="text-base font-semibold">Modo acompanhamento</div>
        <div className="text-sm text-muted-foreground">
          Status: {p.status} - Duracao {fmt(p.durationMs)} - max. 5h
        </div>
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {statusIcon}
          Operacao: {p.operationalStatus} - Transcricao: {transcriptionStatus} - Salvamento: {p.autosaveState}
        </div>
        <div>
          Persistencia: {p.persistenceMode ?? "aguardando"} {p.hasBackendSession ? "(nuvem ativa)" : "(fallback local disponivel)"} -
          Finalizacao: {p.finalizationStage}
        </div>
      </div>
      {p.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">{p.error}</div>
      )}
      {p.operationalEvents.length > 0 && (
        <div className="rounded-xl border border-white/50 bg-white/50 p-3 text-xs text-muted-foreground">
          {p.operationalEvents.slice(-3).map((event) => (
            <p key={`${event.type}-${event.at}`}>{event.message}</p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={p.start} disabled={isRecording || isPaused || isFinishing}>
          <Play className="h-4 w-4 mr-2" />
          Iniciar reuniao
        </Button>
        <Button variant="outline" onClick={isPaused ? p.resume : p.pause} disabled={!(isRecording || isPaused) || isFinishing}>
          <Pause className="h-4 w-4 mr-2" />
          {isPaused ? "Retomar" : "Pausar"}
        </Button>
        <Button variant="destructive" onClick={() => void p.finish()} disabled={!(isRecording || isPaused) || isFinishing}>
          <Square className="h-4 w-4 mr-2" />
          Finalizar reuniao
        </Button>
      </div>
    </div>
  );
}
