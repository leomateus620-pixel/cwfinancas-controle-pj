import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MeetingStatus = "idle" | "recording" | "paused" | "finishing" | "blocked";

export interface TopicSummary {
  decisions: string[];
  actions: string[];
  risks: string[];
  numbers: string[];
  points: string[];
}

interface StartSessionResponse {
  meeting_session_id: string;
  status: "recording";
}

interface FinalizeSessionResponse {
  status: "finished";
  transcript_text: string;
  topic_summary: TopicSummary;
}

const mockRollingLines = [
  "Receita do mês ficou acima do previsto em 8%.",
  "Despesa com marketing subiu e precisa de revisão de contrato.",
  "Decisão: reduzir custo operacional em duas frentes até o próximo ciclo.",
  "Ação: Ana valida categorias de despesas e entrega até sexta-feira.",
  "Risco: inadimplência do cliente X pressiona o caixa das próximas semanas.",
  "Número mencionado: caixa projetado de 120000 para o fechamento.",
];

const sanitizeText = (input: string) => input.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();

export function useMeetingRecorder() {
  const [status, setStatus] = useState<MeetingStatus>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [topicSummary, setTopicSummary] = useState<TopicSummary | null>(null);
  const [meetingSessionId, setMeetingSessionId] = useState<string | null>(null);
  const tickerRef = useRef<number | null>(null);
  const mockIdxRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const clearTicker = () => {
    if (tickerRef.current) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  const startTicker = () => {
    clearTicker();
    tickerRef.current = window.setInterval(() => {
      setTranscriptLines((prev) => {
        const line = mockRollingLines[mockIdxRef.current % mockRollingLines.length];
        mockIdxRef.current += 1;
        return [...prev, line];
      });
    }, 2400);
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.start();

      const { data: startData, error: startErr } = await supabase.functions.invoke("reports-meetings-transcribe", {
        body: { action: "start_session", title: `Reunião ${new Date().toLocaleString("pt-BR")}` },
      });
      if (startErr) throw startErr;

      const parsed = startData as StartSessionResponse;
      setMeetingSessionId(parsed.meeting_session_id);
      setStatus("recording");
      setPermissionError(null);
      setTopicSummary(null);
      setTranscriptLines([]);
      mockIdxRef.current = 0;
      startTicker();
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
    startTicker();
  };

  const finish = async () => {
    if (!meetingSessionId) {
      setPermissionError("Sessão de reunião não encontrada para finalizar");
      return;
    }

    setStatus("finishing");
    clearTicker();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();

    const transcriptText = sanitizeText(transcriptLines.join("\n"));
    const { data, error } = await supabase.functions.invoke("reports-meetings-transcribe", {
      body: { action: "finalize_session", meeting_session_id: meetingSessionId, transcript_text: transcriptText || "Sem conteúdo" },
    });

    if (!error && data) {
      const parsed = data as FinalizeSessionResponse;
      setTopicSummary(parsed.topic_summary);
      setMeetingSessionId(null);
      setStatus("idle");
      return;
    }

    setStatus("blocked");
    setPermissionError("Erro ao finalizar a reunião. Tente novamente.");
  };

  const transcriptText = useMemo(() => transcriptLines.join("\n"), [transcriptLines]);

  return { status, permissionError, transcriptLines, transcriptText, topicSummary, start, pause, resume, finish };
}