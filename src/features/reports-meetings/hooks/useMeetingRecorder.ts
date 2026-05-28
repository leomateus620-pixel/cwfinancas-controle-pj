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
}

interface FinalizeSessionResponse {
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

  const createSession = async () => {
    const { data, error } = await supabase.functions.invoke("reports-meetings-transcribe", {
      body: { action: "start_session", title: `Reunião ${new Date().toLocaleString("pt-BR")}` },
    });

    if (error) throw new Error(error.message || "Falha ao iniciar sessão no servidor");
    const parsed = data as StartSessionResponse;
    if (!parsed?.meeting_session_id) throw new Error("Sessão criada sem ID");
    return parsed.meeting_session_id;
  };

  const start = async () => {
    setPermissionError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("blocked");
      setPermissionError("Seu navegador não suporta captura de áudio");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setStatus("blocked");
      setPermissionError("MediaRecorder indisponível neste navegador/dispositivo");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.start();

      setStatus("recording");
      setTopicSummary(null);
      setTranscriptLines([]);
      mockIdxRef.current = 0;
      startTicker();

      try {
        const sessionId = await createSession();
        setMeetingSessionId(sessionId);
      } catch (sessionError) {
        setPermissionError(
          sessionError instanceof Error
            ? `Áudio iniciado. Sessão remota indisponível: ${sessionError.message}`
            : "Áudio iniciado. Sessão remota indisponível.",
        );
      }
    } catch (err) {
      setStatus("blocked");
      setPermissionError(
        err instanceof Error ? `Sem permissão de microfone: ${err.message}` : "Sem permissão de microfone",
      );
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
    setStatus("finishing");
    clearTicker();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    try {
      const ensuredSessionId = meetingSessionId ?? (await createSession());
      const transcriptText = sanitizeText(transcriptLines.join("\n")) || "Sem conteúdo";

      const { data, error } = await supabase.functions.invoke("reports-meetings-transcribe", {
        body: { action: "finalize_session", meeting_session_id: ensuredSessionId, transcript_text: transcriptText },
      });

      if (error) throw new Error(error.message || "Falha ao finalizar sessão");

      const parsed = data as FinalizeSessionResponse;
      if (parsed?.topic_summary) {
        setTopicSummary(parsed.topic_summary);
      }

      setMeetingSessionId(null);
      setPermissionError(null);
      setStatus("idle");
    } catch (err) {
      setStatus("blocked");
      setPermissionError(err instanceof Error ? `Erro ao finalizar reunião: ${err.message}` : "Erro ao finalizar reunião");
    }
  };

  const transcriptText = useMemo(() => transcriptLines.join("\n"), [transcriptLines]);

  return { status, permissionError, transcriptLines, transcriptText, topicSummary, start, pause, resume, finish };
}
