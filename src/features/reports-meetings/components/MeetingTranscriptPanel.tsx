import { useEffect, useRef } from "react";
import { ScrollText } from "lucide-react";
import type { MeetingStatus } from "../hooks/useMeetingRecorder";
import { GlassPanel, StatusBadge } from "./reportsMeetingUi";

interface Props {
  lines: string[];
  interimTranscript: string;
  status: MeetingStatus;
  manualTranscript: string;
  onManualTranscriptChange: (v: string) => void;
  recognitionUnstable: boolean;
}

export function MeetingTranscriptPanel({ lines, interimTranscript, status, manualTranscript, onManualTranscriptChange, recognitionUnstable }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines, interimTranscript]);

  return (
    <GlassPanel className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-950">
          <ScrollText className="h-5 w-5 text-primary" /> Transcrição em tempo real
        </div>
        <StatusBadge tone={status === "recording" ? "success" : recognitionUnstable ? "warning" : "neutral"}>
          {status} • {lines.length} trechos confirmados
        </StatusBadge>
      </div>
      {recognitionUnstable && (
        <p className="rounded-xl border border-amber-200 bg-amber-50/75 p-3 text-xs text-amber-800">
          Transcrição em tempo real instável. Continue falando: o áudio segue sendo gravado.
        </p>
      )}
      <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-white/70 bg-white/55 p-3 text-sm shadow-inner">
        {lines.length === 0 && !interimTranscript && <p className="text-slate-500">A transcrição confirmada aparecerá aqui durante a reunião.</p>}
        {lines.map((line, index) => (
          <p key={`${line}-${index}`} className="mb-2 rounded-xl bg-white/70 px-3 py-2 leading-relaxed text-slate-700">{line}</p>
        ))}
        {interimTranscript && <p className="mt-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-3 py-2 text-xs italic text-blue-800">Em andamento: {interimTranscript}</p>}
        <div ref={endRef} />
      </div>
      <textarea
        value={manualTranscript}
        onChange={(e) => onManualTranscriptChange(e.target.value)}
        className="min-h-[118px] w-full rounded-2xl border border-white/70 bg-white/62 p-3 text-sm text-slate-800 shadow-inner outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
        placeholder="Cole complementos da ata/transcrição."
      />
    </GlassPanel>
  );
}
