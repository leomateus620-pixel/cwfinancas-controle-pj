import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import type { MeetingStatus } from "../hooks/useMeetingRecorder";

interface MeetingRecorderPanelProps {
  status: MeetingStatus; start: () => void; pause: () => void; resume: () => void; finish: () => void;
  error?: string | null; isSpeechSupported: boolean; persistenceMode?: "edge" | "database" | "local" | null;
  durationMs: number; autosaveState: string; recognitionRestarted: boolean; recognitionUnstable: boolean;
}
const f=(ms:number)=>new Date(ms).toISOString().slice(11,19);
export function MeetingRecorderPanel(p: MeetingRecorderPanelProps) {
  const isRecording = p.status === "recording"; const isPaused = p.status === "paused"; const isFinishing = p.status === "finishing";
  return <div className="liquid-glass space-y-3 rounded-2xl p-4 md:p-5">
    <div><div className="text-base font-semibold">Modo acompanhamento</div><div className="text-sm text-muted-foreground">Status: {p.status} • Duração {f(p.durationMs)} • máx. 5h</div></div>
    <div className="text-xs text-muted-foreground">Microfone: {isRecording||isPaused?"ativo":"inativo"} • Transcrição: {p.isSpeechSupported?"ativa":"indisponível"} • {p.autosaveState}</div>
    {p.recognitionRestarted && <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-2 text-xs text-sky-800">Transcrição reiniciada automaticamente.</div>}
    {p.recognitionUnstable && <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2 text-xs text-amber-800">Transcrição em tempo real instável. Áudio preservado para processamento posterior.</div>}
    {p.error && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{p.error}</span></div>}
    <div className="flex flex-wrap gap-2"><Button onClick={p.start} disabled={isRecording || isPaused || isFinishing}>Iniciar reunião</Button><Button variant="outline" onClick={isPaused ? p.resume : p.pause} disabled={!(isRecording || isPaused) || isFinishing}>{isPaused ? "Retomar" : "Pausar"}</Button><Button variant="destructive" onClick={p.finish} disabled={!(isRecording || isPaused) || isFinishing}>Finalizar reunião</Button></div>
  </div>;
}
