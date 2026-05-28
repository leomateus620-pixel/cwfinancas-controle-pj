import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import type { MeetingStatus } from "../hooks/useMeetingRecorder";

interface MeetingRecorderPanelProps {
  status: MeetingStatus; start: () => void; pause: () => void; resume: () => void; finish: () => void;
  error?: string | null; isSpeechSupported: boolean; persistenceMode?: "edge" | "database" | "local" | null;
  durationMs: number; autosaveState: string; recognitionRestarted: boolean; recognitionUnstable: boolean; finalizationStage: string;
}
const f=(ms:number)=>new Date(ms).toISOString().slice(11,19);
export function MeetingRecorderPanel(p: MeetingRecorderPanelProps) {
  const isRecording = p.status === "recording"; const isPaused = p.status === "paused"; const isFinishing = p.status === "finishing";
  const transcriptionStatus = !p.isSpeechSupported ? "indisponível" : p.recognitionUnstable ? "instável" : p.recognitionRestarted ? "reiniciando" : "ativa";
  return <div className="liquid-glass space-y-3 rounded-2xl p-4 md:p-5">
    <div><div className="text-base font-semibold">Modo acompanhamento</div><div className="text-sm text-muted-foreground">Status: {p.status} • Duração {f(p.durationMs)} • máx. 5h</div></div>
    <div className="text-xs text-muted-foreground">Transcrição: {transcriptionStatus} • Salvamento: {p.autosaveState} • Finalização: {p.finalizationStage}</div>
    {p.error && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{p.error}</span></div>}
    <div className="flex flex-wrap gap-2"><Button onClick={p.start} disabled={isRecording || isPaused || isFinishing}>Iniciar reunião</Button><Button variant="outline" onClick={isPaused ? p.resume : p.pause} disabled={!(isRecording || isPaused) || isFinishing}>{isPaused ? "Retomar" : "Pausar"}</Button><Button variant="destructive" onClick={p.finish} disabled={!(isRecording || isPaused) || isFinishing}>Finalizar reunião</Button></div>
  </div>;
}
