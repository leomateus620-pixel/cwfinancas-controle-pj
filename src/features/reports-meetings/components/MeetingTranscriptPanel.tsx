import { useEffect, useRef } from "react";
import { ScrollText } from "lucide-react";
import type { MeetingStatus } from "../hooks/useMeetingRecorder";

interface Props { lines: string[]; interimTranscript: string; status: MeetingStatus; manualTranscript: string; onManualTranscriptChange: (v: string)=>void; recognitionRestarted: boolean; }

export function MeetingTranscriptPanel({ lines, interimTranscript, status, manualTranscript, onManualTranscriptChange, recognitionRestarted }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines, interimTranscript]);
  return <div className="liquid-glass rounded-2xl p-4 md:p-5"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><ScrollText className="h-4 w-4 text-primary" />Transcrição em tempo real</div><span className="text-xs text-muted-foreground">{status} • {lines.length} trechos</span></div>
    {recognitionRestarted && <p className="mb-2 text-xs text-sky-700">Reconhecimento reiniciado automaticamente para manter a reunião ativa.</p>}
    <div className="max-h-[280px] overflow-y-auto rounded-xl border border-white/40 bg-white/50 p-3 text-sm">{lines.map((line,i)=><p key={`${line}-${i}`} className="mb-2">• {line}</p>)}{interimTranscript && <p className="mt-2 text-xs italic text-muted-foreground">Ouvindo… {interimTranscript}</p>}<div ref={endRef} /></div>
    <textarea value={manualTranscript} onChange={(e)=>onManualTranscriptChange(e.target.value)} className="mt-3 min-h-[90px] w-full rounded-xl border border-white/40 bg-white/50 p-2 text-sm" placeholder="Cole complemento da ata/transcrição." />
  </div>;
}
