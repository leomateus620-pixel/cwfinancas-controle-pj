import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MeetingStatus = "idle" | "recording" | "paused" | "finishing" | "blocked";

const mockRollingLines = [
  "Receita do mês ficou acima do previsto em 8%.",
  "Despesa com marketing subiu e precisa de revisão de contrato.",
  "Decisão: reduzir custo operacional em duas frentes até o próximo ciclo.",
  "Ação: Ana valida categorias de despesas e entrega até sexta-feira.",
  "Risco: inadimplência do cliente X pressiona o caixa das próximas semanas.",
  "Número mencionado: caixa projetado de 120000 para o fechamento.",
];

function sanitizeText(input: string) {
  return input.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

export function useMeetingRecorder() {
  const [status, setStatus] = useState<MeetingStatus>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [topicSummary, setTopicSummary] = useState<any | null>(null);
  const [meetingSessionId, setMeetingSessionId] = useState<string | null>(null);
  const tickerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const clearTicker = () => {
    if (tickerRef.current) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  const start = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Sessão inválida");

      const { data: startData, error: startErr } = await supabase.functions.invoke("reports-meetings-transcribe", {
        body: { action: "start_session", title: `Reunião ${new Date().toLocaleString("pt-BR")}` },
      });
      if (startErr) throw startErr;
      if (startData?.meeting_session_id) setMeetingSessionId(startData.meeting_session_id);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.start();
      setStatus("recording");
      setPermissionError(null);
      setTopicSummary(null);
      setTranscriptLines([]);
      let idx = 0;
      clearTicker();
      tickerRef.current = window.setInterval(() => {
        setTranscriptLines((prev) => [...prev, mockRollingLines[idx % mockRollingLines.length]]);
        idx++;
      }, 2400);
    } catch {
      setStatus("blocked");
      setPermissionError("Sem permissão de microfone ou sessão indisponível");
    }
  };

  const pause = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.pause();
    setStatus("paused");
    clearTicker();
  };

  const resume = () => {
    if (mediaRecorderRef.current?.state === "paused") mediaRecorderRef.current.resume();
    setStatus("recording");
  };

  const finish = async () => {
    setStatus("finishing");
    clearTicker();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();

    const transcriptText = sanitizeText(transcriptLines.join("\n"));
    const { data, error } = await supabase.functions.invoke("reports-meetings-transcribe", {
      body: { action: "finalize_session", meeting_session_id: meetingSessionId, transcript_text: transcriptText },
    });

    if (!error && data?.topic_summary) setTopicSummary(data.topic_summary);
    setStatus("idle");
  };

  const transcriptText = useMemo(() => transcriptLines.join("\n"), [transcriptLines]);

  return { status, permissionError, transcriptLines, transcriptText, topicSummary, start, pause, resume, finish };
}
