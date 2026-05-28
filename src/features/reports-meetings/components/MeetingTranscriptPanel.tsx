import { ScrollText } from "lucide-react";
import type { MeetingStatus } from "../hooks/useMeetingRecorder";

interface Props {
  lines: string[];
  interimTranscript: string;
  status: MeetingStatus;
  isSpeechSupported: boolean;
  manualTranscript: string;
  onManualTranscriptChange: (value: string) => void;
}

const statusLabel: Record<MeetingStatus, string> = {
  idle: "Aguardando",
  recording: "Capturando",
  paused: "Pausado",
  finishing: "Finalizando",
  blocked: "Bloqueado",
};

export function MeetingTranscriptPanel({ lines, interimTranscript, status, isSpeechSupported, manualTranscript, onManualTranscriptChange }: Props) {
  const dynamicHeight = Math.min(380, 150 + lines.length * 18);
  return (
    <div className="liquid-glass rounded-2xl p-4 transition-all duration-300 md:p-5" style={{ minHeight: dynamicHeight }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold"><ScrollText className="h-4 w-4 text-primary" />Transcrição em tempo real</div>
        <span className="text-xs text-muted-foreground">{statusLabel[status]}</span>
      </div>
      {!isSpeechSupported && <p className="mb-2 text-xs text-amber-700">Transcrição automática em tempo real não suportada neste navegador. Grave a reunião ou cole a transcrição manualmente.</p>}
      <div className="max-h-[280px] overflow-y-auto rounded-xl border border-white/40 bg-white/50 p-3 text-sm leading-relaxed">
        {lines.length === 0 ? <p className="text-muted-foreground">Inicie a reunião e fale no microfone para transcrever.</p> : lines.map((line, i) => <p key={`${line}-${i}`} className="mb-2 last:mb-0">• {line}</p>)}
        {interimTranscript && <p className="mt-2 text-xs italic text-muted-foreground">Ouvindo… {interimTranscript}</p>}
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Transcrição/ata manual (opcional)</label>
        <textarea value={manualTranscript} onChange={(e) => onManualTranscriptChange(e.target.value)} className="min-h-[90px] w-full rounded-xl border border-white/40 bg-white/50 p-2 text-sm" placeholder="Cole aqui a transcrição manual quando necessário." />
      </div>
    </div>
  );
}
