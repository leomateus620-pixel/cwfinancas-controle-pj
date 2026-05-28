import { ScrollText } from "lucide-react";
import type { MeetingStatus } from "../hooks/useMeetingRecorder";

interface Props {
  lines: string[];
  status: MeetingStatus;
}

const statusLabel: Record<MeetingStatus, string> = {
  idle: "Aguardando",
  recording: "Capturando",
  paused: "Pausado",
  finishing: "Finalizando",
  blocked: "Bloqueado",
};

export function MeetingTranscriptPanel({ lines, status }: Props) {
  const dynamicHeight = Math.min(360, 120 + lines.length * 18);

  return (
    <div className="liquid-glass rounded-2xl p-4 transition-all duration-300 md:p-5" style={{ minHeight: dynamicHeight }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ScrollText className="h-4 w-4 text-primary" />
          Transcrição em tempo real
        </div>
        <span className="text-xs text-muted-foreground">{statusLabel[status]}</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto rounded-xl border border-white/40 bg-white/50 p-3 text-sm leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-muted-foreground">Ao iniciar a reunião, a transcrição começa automaticamente neste card.</p>
        ) : (
          lines.map((line, i) => (
            <p key={`${line}-${i}`} className="mb-2 last:mb-0">
              • {line}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
