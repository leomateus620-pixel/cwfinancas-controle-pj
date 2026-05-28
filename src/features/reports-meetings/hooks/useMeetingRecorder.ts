import { useEffect, useMemo, useRef, useState } from "react";
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

declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
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

const PUBLIC_URL = "https://cwfinancas-controle-pj.lovable.app/relatorios-reunioes";
const sanitizeText = (input: string) => input.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
const normalizeText = (input: string) => sanitizeText(input).toLocaleLowerCase("pt-BR");

function summarizeError(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) return String((err as { message?: unknown }).message);
  return "Erro desconhecido";
}

function dedupe(values: string[]) {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = normalizeText(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTopicSummary(text: string): TopicSummary {
  const parts = dedupe(
    text
      .split(/[\n\.\!\?]/)
      .map((x) => sanitizeText(x))
      .filter(Boolean),
  );

  return {
    decisions: parts.filter((p) => /decidimos|ficou decidido|decisão|decisao|vamos fazer/i.test(p)),
    actions: parts.filter((p) => /responsável|responsavel|precisa fazer|\bvou\b|\bvamos\b|prazo|entregar|ajustar|revisar/i.test(p)),
    risks: parts.filter((p) => /risco|problema|atraso|inadimplência|inadimplencia|queda|negativo|preocupação|preocupacao/i.test(p)),
    numbers: parts.filter((p) => /\d|r\$|\d+%|\d{1,2}\/\d{1,2}(\/\d{2,4})?/i.test(p)),
    points: parts,
  };
}

function createLocalId() {
  if (globalThis.crypto?.randomUUID) return `local-${globalThis.crypto.randomUUID()}`;
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function describeMicError(err: unknown): string {
  if (!(err instanceof Error)) return "Não foi possível acessar o microfone.";
  const name = (err as DOMException).name;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Permissão de microfone negada. Libere o microfone ou cole a transcrição manualmente.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Nenhum microfone foi detectado. Grave a reunião ou cole a transcrição manualmente.";
    default:
      return err.message || "Falha ao acessar o microfone.";
  }
}

async function createDatabaseSession(title: string): Promise<StartSessionResult> { /* unchanged */
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) throw new Error("Usuário não autenticado para abrir sessão da reunião.");
  const { data, error } = await db.from("meeting_sessions").insert({ user_id: user.id, title: sanitizeText(title), status: "recording", started_at: new Date().toISOString() }).select("id").single();
  if (error) throw error;
  await db.from("meeting_audit_logs").insert({ user_id: user.id, entity_type: "meeting_session", entity_id: data.id, action: "meeting_started_frontend_fallback", metadata: { source: "frontend_fallback" } });
  return { id: data.id, mode: "database", warning: "Edge Function indisponível. A reunião foi iniciada por fallback seguro direto no banco." };
}

async function openMeetingSession(title: string): Promise<StartSessionResult> {
  try {
    const { data, error } = await supabase.functions.invoke("reports-meetings-transcribe", { body: { action: "start_session", title } });
    if (error) throw error;
    const parsed = data as StartSessionResponse;
    if (!parsed?.meeting_session_id) throw new Error("Resposta inválida da Edge Function.");
    return { id: parsed.meeting_session_id, mode: "edge", warning: null };
  } catch {
    try {
      return await createDatabaseSession(title);
    } catch {
      return { id: createLocalId(), mode: "local", warning: "Sessão iniciada em modo local (sem persistência no backend)." };
    }
  }
}

async function finalizeDatabaseSession(sessionId: string, transcript: string, topicSummary: TopicSummary, audioStoragePath?: string | null) {
  const { error } = await db.from("meeting_sessions").update({ status: "finished", ended_at: new Date().toISOString(), transcript_text: transcript, transcript_segments: topicSummary.points, action_items: topicSummary.actions, decisions: topicSummary.decisions, mentioned_numbers: topicSummary.numbers, audio_storage_path: audioStoragePath ?? null }).eq("id", sessionId);
  if (error) throw error;
}

export function useMeetingRecorder() {
  const [status, setStatus] = useState<MeetingStatus>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [manualTranscript, setManualTranscript] = useState("");
  const [topicSummary, setTopicSummary] = useState<TopicSummary | null>(null);
  const [meetingSessionId, setMeetingSessionId] = useState<string | null>(null);
  const [persistenceMode, setPersistenceMode] = useState<SessionPersistenceMode | null>(null);

  const audioChunksRef = useRef<BlobPart[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupResources = () => {
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recognitionRef.current = null;
    mediaRecorderRef.current = null;
    streamRef.current = null;
  };

  const pushTranscriptLine = (text: string) => {
    const clean = sanitizeText(text);
    if (!clean) return;
    setTranscriptLines((prev) => (prev.some((line) => normalizeText(line) === normalizeText(clean)) ? prev : [...prev, clean]));
  };

  const getSpeechCtor = () => (typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined);

  useEffect(() => {
    setIsSpeechSupported(Boolean(getSpeechCtor()));
    return cleanupResources;
  }, []);

  const start = async () => {
    cleanupResources();
    setStatus("idle");
    setPermissionError(null);
    setTopicSummary(null);
    setInterimTranscript("");
    setTranscriptLines([]);
    audioChunksRef.current = [];

    const title = `Reunião ${new Date().toLocaleString("pt-BR")}`;
    const speechCtor = getSpeechCtor();
    const warnings: string[] = [];

    if (!speechCtor) warnings.push("Transcrição automática em tempo real não suportada neste navegador. Grave a reunião ou cole a transcrição manualmente.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (typeof MediaRecorder !== "undefined") {
        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
        mediaRecorderRef.current.start();
      }
    } catch (err) {
      setStatus("blocked");
      setPermissionError(describeMicError(err));
      return;
    }

    if (speechCtor) {
      const recognition = new speechCtor();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) pushTranscriptLine(text);
          else interim = `${interim} ${text}`.trim();
        }
        setInterimTranscript(sanitizeText(interim));
      };
      recognition.onend = () => {
        if (status === "recording") {
          try { recognition.start(); } catch { /* noop */ }
        }
      };
      recognitionRef.current = recognition;
      try { recognition.start(); } catch (e) { warnings.push(`Falha ao iniciar transcrição automática: ${summarizeError(e)}`); }
    }

    const session = await openMeetingSession(title);
    setMeetingSessionId(session.id);
    setPersistenceMode(session.mode);
    if (session.warning) warnings.push(session.warning);
    setPermissionError(warnings.join(" ") || null);
    setStatus("recording");
  };

  const pause = () => {
    mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.pause();
    recognitionRef.current?.stop();
    setStatus("paused");
  };

  const resume = () => {
    mediaRecorderRef.current?.state === "paused" && mediaRecorderRef.current.resume();
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch { /* noop */ }
    }
    setStatus("recording");
  };

  const finish = async () => {
    if (!meetingSessionId) return setPermissionError("Sessão de reunião não encontrada para finalizar.");
    setStatus("finishing");
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    const manualText = sanitizeText(manualTranscript);
    const transcriptText = sanitizeText([...transcriptLines, manualText].filter(Boolean).join("\n"));
    if (!transcriptText) {
      setPermissionError("Nenhuma fala foi transcrita. Verifique microfone/permissão ou cole a transcrição manualmente.");
      setStatus("idle");
      return;
    }

    const localSummary = buildTopicSummary(transcriptText);
    const hasContent = localSummary.decisions.length + localSummary.actions.length + localSummary.risks.length + localSummary.numbers.length > 0;
    if (!hasContent) setPermissionError("Dados insuficientes para gerar resumo da reunião.");

    const audioBlob = audioChunksRef.current.length ? new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || "audio/webm" }) : null;
    let audioStoragePath: string | null = null;
    if (audioBlob && meetingSessionId && persistenceMode !== "local") {
      const filePath = `${meetingSessionId}/${Date.now()}.webm`;
      const { error } = await supabase.storage.from("meeting-reports").upload(filePath, audioBlob, { upsert: true, contentType: audioBlob.type });
      if (!error) audioStoragePath = filePath;
    }

    try {
      if (persistenceMode === "edge") {
        const { data, error } = await supabase.functions.invoke("reports-meetings-transcribe", { body: { action: "finalize_session", meeting_session_id: meetingSessionId, transcript_text: transcriptText, audio_storage_path: audioStoragePath } });
        if (error) throw error;
        const parsed = data as FinalizeSessionResponse;
        setTopicSummary(parsed.topic_summary ?? localSummary);
      } else if (persistenceMode === "database") {
        await finalizeDatabaseSession(meetingSessionId, transcriptText, localSummary, audioStoragePath);
        setTopicSummary(localSummary);
      } else setTopicSummary(localSummary);
      setStatus("idle");
    } catch {
      setTopicSummary(localSummary);
      setStatus("idle");
      setPermissionError("Resumo gerado localmente, mas houve falha ao salvar/finalizar no backend.");
    }
  };

  return { status, permissionError, isSpeechSupported, interimTranscript, transcriptLines, transcriptText: useMemo(() => transcriptLines.join("\n"), [transcriptLines]), topicSummary, manualTranscript, setManualTranscript, publicUrl: PUBLIC_URL, persistenceMode, start, pause, resume, finish };
}
