import { useEffect, useMemo, useRef, useState } from "react";
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

const PUBLIC_URL = "https://cwfinancas-controle-pj.lovable.app/relatorios-reunioes";

function describeMicError(err: unknown): string {
  if (!(err instanceof Error)) return "Não foi possível acessar o microfone.";
  const name = (err as DOMException).name;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Permissão de microfone negada. Libere o microfone nas configurações do navegador.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Nenhum microfone foi detectado neste dispositivo.";
    case "NotReadableError":
      return "O microfone está sendo usado por outro aplicativo.";
    default:
      return err.message || "Falha ao acessar o microfone.";
  }
}

async function tryGetMic(): Promise<MediaStream | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return null;
  }
}

export function useMeetingRecorder() {
  const [status, setStatus] = useState<MeetingStatus>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [topicSummary, setTopicSummary] = useState<TopicSummary | null>(null);
  const [meetingSessionId, setMeetingSessionId] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const tickerRef = useRef<number | null>(null);
  const mockIdxRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const clearTicker = () => {
    if (tickerRef.current) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  const stopStream = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  useEffect(() => () => {
    clearTicker();
    stopStream();
  }, []);

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
    setPermissionError(null);
    setTopicSummary(null);
    setTranscriptLines([]);
    mockIdxRef.current = 0;

    // 1) Try microphone — failure means demo mode, not blocked
    let micWarning: string | null = null;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
    } catch (err) {
      micWarning = describeMicError(err);
      stream = null;
    }
    if (!stream) {
      stream = await tryGetMic();
    }

    if (stream) {
      try {
        streamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.start();
        setDemoMode(false);
      } catch (err) {
        micWarning = describeMicError(err);
        stopStream();
        setDemoMode(true);
      }
    } else {
      setDemoMode(true);
    }

    // 2) Open backend session
    try {
      const { data, error } = await supabase.functions.invoke("reports-meetings-transcribe", {
        body: { action: "start_session", title: `Reunião ${new Date().toLocaleString("pt-BR")}` },
      });
      if (error) throw error;
      const parsed = data as StartSessionResponse;
      setMeetingSessionId(parsed.meeting_session_id);
      setStatus("recording");
      setPermissionError(micWarning); // keep mic warning visible alongside demo banner
      startTicker();
    } catch (err) {
      stopStream();
      clearTicker();
      setStatus("idle");
      const msg = err instanceof Error ? err.message : "Falha ao iniciar sessão de reunião.";
      setPermissionError(`Não foi possível iniciar a reunião: ${msg}`);
    }
  };

  const pause = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      try { mediaRecorderRef.current.pause(); } catch { /* noop */ }
    }
    setStatus("paused");
    clearTicker();
  };

  const resume = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      try { mediaRecorderRef.current.resume(); } catch { /* noop */ }
    }
    setStatus("recording");
    startTicker();
  };

  const finish = async () => {
    if (!meetingSessionId) {
      setPermissionError("Sessão de reunião não encontrada para finalizar.");
      return;
    }

    setStatus("finishing");
    clearTicker();
    stopStream();

    const transcriptText = sanitizeText(transcriptLines.join("\n")) || "Sem conteúdo";
    const { data, error } = await supabase.functions.invoke("reports-meetings-transcribe", {
      body: { action: "finalize_session", meeting_session_id: meetingSessionId, transcript_text: transcriptText },
    });

    if (!error && data) {
      const parsed = data as FinalizeSessionResponse;
      setTopicSummary(parsed.topic_summary);
      setMeetingSessionId(null);
      setStatus("idle");
      setDemoMode(false);
      return;
    }

    setStatus("idle");
    const msg = error instanceof Error ? error.message : "Erro ao finalizar a reunião. Tente novamente.";
    setPermissionError(msg);
  };

  const transcriptText = useMemo(() => transcriptLines.join("\n"), [transcriptLines]);

  return {
    status,
    permissionError,
    transcriptLines,
    transcriptText,
    topicSummary,
    demoMode,
    publicUrl: PUBLIC_URL,
    start,
    pause,
    resume,
    finish,
  };
}
