import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

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

type SessionPersistenceMode = "edge" | "database" | "local";

interface StartSessionResult {
  id: string;
  mode: SessionPersistenceMode;
  warning: string | null;
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

function summarizeError(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) return String((err as { message?: unknown }).message);
  return "Erro desconhecido";
}

function describeMicError(err: unknown): string {
  if (!(err instanceof Error)) return "Não foi possível acessar o microfone.";
  const name = (err as DOMException).name;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Permissão de microfone negada. A reunião continuará em modo de acompanhamento; libere o microfone para capturar áudio real.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Nenhum microfone foi detectado. A reunião continuará em modo de acompanhamento.";
    case "NotReadableError":
      return "O microfone está sendo usado por outro aplicativo. A reunião continuará em modo de acompanhamento.";
    default:
      return err.message || "Falha ao acessar o microfone. A reunião continuará em modo de acompanhamento.";
  }
}

function buildTopicSummary(text: string): TopicSummary {
  const parts = text
    .split(/[\n\.]/)
    .map((x) => sanitizeText(x))
    .filter(Boolean);

  return {
    decisions: parts.filter((p) => /decisão|decisao/i.test(p)),
    actions: parts.filter((p) => /ação:|acao:|responsável|responsavel|prazo|ajustar|revisar/i.test(p)),
    risks: parts.filter((p) => /risco|inadimpl|atraso|queda|negativo/i.test(p)),
    numbers: parts.filter((p) => /\d/.test(p)),
    points: parts.filter((p) => !/decisão|decisao|ação:|acao:|risco/i.test(p)),
  };
}

async function getMicStream(): Promise<{ stream: MediaStream | null; warning: string | null }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { stream: null, warning: "Microfone não disponível neste navegador. A reunião continuará em modo de acompanhamento." };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return { stream, warning: null };
  } catch (err) {
    return { stream: null, warning: describeMicError(err) };
  }
}

async function createDatabaseSession(title: string): Promise<StartSessionResult> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) throw new Error("Usuário não autenticado para abrir sessão da reunião.");

  const { data, error } = await db
    .from("meeting_sessions")
    .insert({
      user_id: user.id,
      title: sanitizeText(title),
      status: "recording",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;

  const { error: auditError } = await db.from("meeting_audit_logs").insert({
    user_id: user.id,
    entity_type: "meeting_session",
    entity_id: data.id,
    action: "meeting_started_frontend_fallback",
    metadata: { source: "frontend_fallback" },
  });

  if (auditError) {
    console.warn("[reports-meetings] audit log fallback failed", auditError.message);
  }

  return {
    id: data.id,
    mode: "database",
    warning: "Edge Function indisponível. A reunião foi iniciada por fallback seguro direto no banco.",
  };
}

async function openMeetingSession(title: string): Promise<StartSessionResult> {
  try {
    const { data, error } = await supabase.functions.invoke("reports-meetings-transcribe", {
      body: { action: "start_session", title },
    });

    if (error) throw error;
    const parsed = data as StartSessionResponse;
    if (!parsed?.meeting_session_id) throw new Error("Resposta inválida da Edge Function.");

    return { id: parsed.meeting_session_id, mode: "edge", warning: null };
  } catch (edgeError) {
    console.warn("[reports-meetings] Edge Function start failed, trying database fallback", summarizeError(edgeError));

    try {
      return await createDatabaseSession(title);
    } catch (dbError) {
      console.warn("[reports-meetings] database fallback failed, using local session", summarizeError(dbError));
      return {
        id: `local-${crypto.randomUUID()}`,
        mode: "local",
        warning:
          "Edge Function e banco não aceitaram a sessão. A reunião continuará localmente; o resumo não será salvo até a infraestrutura ser publicada.",
      };
    }
  }
}

async function finalizeDatabaseSession(sessionId: string, transcript: string, topicSummary: TopicSummary) {
  const { error } = await db
    .from("meeting_sessions")
    .update({
      status: "finished",
      ended_at: new Date().toISOString(),
      transcript_text: transcript,
      transcript_segments: topicSummary.points,
      action_items: topicSummary.actions,
      decisions: topicSummary.decisions,
      mentioned_numbers: topicSummary.numbers,
    })
    .eq("id", sessionId);

  if (error) throw error;
}

export function useMeetingRecorder() {
  const [status, setStatus] = useState<MeetingStatus>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [topicSummary, setTopicSummary] = useState<TopicSummary | null>(null);
  const [meetingSessionId, setMeetingSessionId] = useState<string | null>(null);
  const [persistenceMode, setPersistenceMode] = useState<SessionPersistenceMode | null>(null);
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

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
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
    clearTicker();
    stopStream();
    setStatus("idle");
    setPermissionError(null);
    setTopicSummary(null);
    setTranscriptLines([]);
    mockIdxRef.current = 0;

    const title = `Reunião ${new Date().toLocaleString("pt-BR")}`;
    const mic = await getMicStream();
    let warning = mic.warning;

    if (mic.stream && typeof MediaRecorder !== "undefined") {
      try {
        streamRef.current = mic.stream;
        mediaRecorderRef.current = new MediaRecorder(mic.stream);
        mediaRecorderRef.current.start();
      } catch (err) {
        warning = describeMicError(err);
        stopStream();
      }
    } else if (mic.stream) {
      streamRef.current = mic.stream;
      warning = "Este navegador não suporta MediaRecorder. A reunião continuará em modo de acompanhamento.";
    }

    const session = await openMeetingSession(title);
    setMeetingSessionId(session.id);
    setPersistenceMode(session.mode);
    setStatus("recording");
    setPermissionError([warning, session.warning].filter(Boolean).join(" ") || null);
    startTicker();
  };

  const pause = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      try {
        mediaRecorderRef.current.pause();
      } catch {
        /* noop */
      }
    }
    setStatus("paused");
    clearTicker();
  };

  const resume = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      try {
        mediaRecorderRef.current.resume();
      } catch {
        /* noop */
      }
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
    const localSummary = buildTopicSummary(transcriptText);

    try {
      if (persistenceMode === "edge") {
        const { data, error } = await supabase.functions.invoke("reports-meetings-transcribe", {
          body: { action: "finalize_session", meeting_session_id: meetingSessionId, transcript_text: transcriptText },
        });

        if (error) throw error;
        const parsed = data as FinalizeSessionResponse;
        setTopicSummary(parsed.topic_summary ?? localSummary);
      } else if (persistenceMode === "database") {
        await finalizeDatabaseSession(meetingSessionId, transcriptText, localSummary);
        setTopicSummary(localSummary);
      } else {
        setTopicSummary(localSummary);
      }

      setMeetingSessionId(null);
      setPersistenceMode(null);
      setStatus("idle");
      setPermissionError(persistenceMode === "local" ? "Resumo gerado localmente. Esta sessão não foi salva no banco." : null);
    } catch (err) {
      console.warn("[reports-meetings] finalize failed, keeping local summary", summarizeError(err));
      setTopicSummary(localSummary);
      setMeetingSessionId(null);
      setPersistenceMode(null);
      setStatus("idle");
      setPermissionError("Resumo gerado localmente, mas houve falha ao salvar/finalizar no backend.");
    }
  };

  const transcriptText = useMemo(() => transcriptLines.join("\n"), [transcriptLines]);

  return {
    status,
    permissionError,
    transcriptLines,
    transcriptText,
    topicSummary,
    persistenceMode,
    start,
    pause,
    resume,
    finish,
  };
}
