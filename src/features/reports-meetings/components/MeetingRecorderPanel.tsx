import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDot, Clock, Database, Pause, Play, Save, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MeetingStatus } from "../hooks/useMeetingRecorder";
import type { OperationalEvent, TopicSummary } from "../lib/meetingRecorderUtils";
import { GlassPanel, StatusBadge } from "./reportsMeetingUi";

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
    ? "Fallback manual"
    : p.recognitionUnstable
      ? "Instável"
      : p.recognitionRestarted
        ? "Reiniciada"
        : "Ativa";
  const statusIcon =
    p.operationalStatus === "stable" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    ) : p.operationalStatus === "fallback" ? (
      <AlertTriangle className="h-4 w-4 text-amber-600" />
    ) : (
      <CircleDot className="h-4 w-4 text-blue-600" />
    );

  return (
    <GlassPanel className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-950">Modo acompanhamento</h3>
          <p className="mt-1 text-sm text-slate-600">Status: {statusLabel(p.status)} • duração {fmt(p.durationMs)} • limite de 5h</p>
        </div>
        <StatusBadge tone={isRecording ? "success" : isPaused ? "warning" : "neutral"}>{statusLabel(p.status)}</StatusBadge>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <StateTile icon={<Clock className="h-4 w-4" />} label="Duração" value={fmt(p.durationMs)} />
        <StateTile icon={<CircleDot className="h-4 w-4" />} label="Transcrição" value={transcriptionStatus} />
        <StateTile icon={<Save className="h-4 w-4" />} label="Salvamento" value={p.autosaveState} />
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/50 p-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          {statusIcon}
          <span>Operação: {operationalLabel(p.operationalStatus)}</span>
          <span className="text-slate-300">•</span>
          <Database className="h-3.5 w-3.5 text-slate-400" />
          <span>
            Persistência: {p.persistenceMode ?? "aguardando"} {p.hasBackendSession ? "(nuvem ativa)" : "(fallback local disponível)"}
          </span>
          <span className="text-slate-300">•</span>
          <span>Finalização: {p.finalizationStage}</span>
        </div>
      </div>

      {p.error && <div className="rounded-2xl border border-amber-200 bg-amber-50/75 p-3 text-sm text-amber-800">{p.error}</div>}
      {p.operationalEvents.length > 0 && (
        <div className="rounded-2xl border border-white/70 bg-white/48 p-3 text-xs text-slate-500">
          {p.operationalEvents.slice(-3).map((event) => (
            <p key={`${event.type}-${event.at}`}>{event.message}</p>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={p.start} disabled={isRecording || isPaused || isFinishing} className="rounded-xl transition-all hover:-translate-y-0.5 active:scale-[0.98]">
          <Play className="mr-2 h-4 w-4" /> Iniciar reunião
        </Button>
        <Button variant="outline" onClick={isPaused ? p.resume : p.pause} disabled={!(isRecording || isPaused) || isFinishing} className="rounded-xl bg-white/60 transition-all hover:-translate-y-0.5 active:scale-[0.98]">
          <Pause className="mr-2 h-4 w-4" /> {isPaused ? "Retomar" : "Pausar"}
        </Button>
        <Button variant="destructive" onClick={() => void p.finish()} disabled={!(isRecording || isPaused) || isFinishing} className="rounded-xl bg-rose-600 transition-all hover:-translate-y-0.5 hover:bg-rose-700 active:scale-[0.98]">
          <Square className="mr-2 h-4 w-4" /> Finalizar reunião
        </Button>
      </div>
    </GlassPanel>
  );
}

function StateTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/58 p-3 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{icon}{label}</div>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function statusLabel(status: MeetingStatus) {
  const labels: Record<MeetingStatus, string> = {
    idle: "Pronta",
    recording: "Gravando",
    paused: "Pausada",
    finishing: "Finalizando",
    blocked: "Bloqueada",
  };
  return labels[status] ?? status;
}

function operationalLabel(status: TopicSummary["operationalStatus"]) {
  return { stable: "estável", fallback: "fallback", attention: "atenção" }[status] ?? status;
}
