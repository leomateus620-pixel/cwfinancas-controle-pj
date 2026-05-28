import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildAutosavePayload, buildFinalTranscript, buildTopicSummary, dedupeTranscriptSegments, sanitizeText, shouldAutoFinishMeeting, type TopicSummary } from "../lib/meetingRecorderUtils";

const db = supabase as any;
export type MeetingStatus = "idle" | "recording" | "paused" | "finishing" | "blocked";
export type SessionPersistenceMode = "edge" | "database" | "local";

declare global { interface Window { webkitSpeechRecognition?: typeof SpeechRecognition; } }

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
  const [durationMs, setDurationMs] = useState(0);
  const [autosaveState, setAutosaveState] = useState("Ainda não salvo");
  const [recognitionRestarted, setRecognitionRestarted] = useState(false);
  const [recognitionUnstable, setRecognitionUnstable] = useState(false);

  const audioChunksRef = useRef<string[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const autosaveRef = useRef<number | null>(null);
  const meetingStartedAtRef = useRef<number>(0);
  const shouldKeepRecognitionAliveRef = useRef(false);
  const recognitionRestartTimeoutRef = useRef<number | null>(null);
  const recognitionManuallyStoppedRef = useRef(false);
  const lastSpeechAtRef = useRef<number>(0);
  const recognitionErrorCountRef = useRef(0);

  const getSpeechCtor = () => (typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined);
  const pushTranscriptLine = (text: string) => setTranscriptLines((p) => dedupeTranscriptSegments([...p, text]));
  const clearTimers = () => { if (timerRef.current) window.clearInterval(timerRef.current); if (autosaveRef.current) window.clearInterval(autosaveRef.current); if (recognitionRestartTimeoutRef.current) window.clearTimeout(recognitionRestartTimeoutRef.current); };

  async function autosaveMeetingProgress() {
    if (!meetingSessionId || persistenceMode === "local") return;
    const transcript = buildFinalTranscript(transcriptLines, interimTranscript, manualTranscript);
    const payload = buildAutosavePayload({ meeting_session_id: meetingSessionId, transcript_text: transcript, transcript_segments: transcriptLines, live_transcript_segments: dedupeTranscriptSegments([...transcriptLines, interimTranscript].filter(Boolean)), duration_seconds: Math.floor(durationMs / 1000), audio_chunks: audioChunksRef.current, last_interim_text: interimTranscript || undefined });
    try {
      await supabase.functions.invoke("reports-meetings-transcribe", { body: payload });
      setAutosaveState("Salvo há instantes");
    } catch { setAutosaveState("Falha no salvamento automático, tentando novamente…"); }
  }

  const finish = async (reason?: string) => {
    if (!meetingSessionId) return;
    setStatus("finishing");
    shouldKeepRecognitionAliveRef.current = false;
    recognitionManuallyStoppedRef.current = true;
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearTimers();
    const transcriptText = buildFinalTranscript(transcriptLines, interimTranscript, manualTranscript);
    if (!transcriptText) setPermissionError("Nenhuma fala foi transcrita. O áudio foi preservado para processamento posterior.");
    const summary = buildTopicSummary(transcriptText);
    try {
      await supabase.functions.invoke("reports-meetings-transcribe", { body: { action: "finalize_session", meeting_session_id: meetingSessionId, transcript_text: transcriptText, audio_chunks: audioChunksRef.current, duration_seconds: Math.floor(durationMs / 1000) } });
    } catch {
      await db.from("meeting_sessions").update({ status: "finished", ended_at: new Date().toISOString(), transcript_text: transcriptText, transcript_segments: summary.points, action_items: summary.actions, decisions: summary.decisions, mentioned_numbers: summary.numbers, audio_chunks: audioChunksRef.current, duration_seconds: Math.floor(durationMs / 1000) }).eq("id", meetingSessionId);
    }
    if (reason) setPermissionError(reason);
    setTopicSummary(summary);
    setStatus("idle");
  };

  const start = async () => {
    setStatus("idle"); setPermissionError(null); setTranscriptLines([]); setInterimTranscript(""); setManualTranscript(""); setDurationMs(0); setRecognitionRestarted(false); setRecognitionUnstable(false);
    const { data } = await supabase.functions.invoke("reports-meetings-transcribe", { body: { action: "start_session", title: `Reunião ${new Date().toLocaleString("pt-BR")}` } });
    const sessionId = data?.meeting_session_id;
    setMeetingSessionId(sessionId); setPersistenceMode("edge");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    if (typeof MediaRecorder !== "undefined") {
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (!event.data?.size || !sessionId) return;
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData.user?.id ?? "anon";
        const filePath = `${uid}/${sessionId}/audio/chunk-${Date.now()}.webm`;
        const { error } = await supabase.storage.from("meeting-reports").upload(filePath, event.data, { upsert: true, contentType: event.data.type || "audio/webm" });
        if (!error) audioChunksRef.current = [...audioChunksRef.current, filePath];
      };
      mediaRecorderRef.current.start(30000);
    }

    const speechCtor = getSpeechCtor();
    setIsSpeechSupported(Boolean(speechCtor));
    if (speechCtor) {
      const rec = new speechCtor(); rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = true;
      rec.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]; const text = sanitizeText(result[0]?.transcript ?? "");
          if (result.isFinal) pushTranscriptLine(text); else interim = `${interim} ${text}`.trim();
        }
        if (interim) lastSpeechAtRef.current = Date.now();
        setInterimTranscript(interim);
      };
      rec.onerror = (e: any) => {
        if (["no-speech", "network", "audio-capture", "aborted"].includes(e.error)) recognitionErrorCountRef.current += 1;
        if (recognitionErrorCountRef.current >= 4) { setRecognitionUnstable(true); setPermissionError("Transcrição em tempo real instável. O áudio continua sendo gravado para processamento posterior."); }
      };
      rec.onend = () => {
        if (status === "recording" && shouldKeepRecognitionAliveRef.current && !recognitionManuallyStoppedRef.current) {
          recognitionRestartTimeoutRef.current = window.setTimeout(() => { try { rec.start(); setRecognitionRestarted(true); } catch {} }, 700);
        }
      };
      recognitionRef.current = rec; shouldKeepRecognitionAliveRef.current = true; recognitionManuallyStoppedRef.current = false; try { rec.start(); } catch {}
    }

    meetingStartedAtRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - meetingStartedAtRef.current;
      setDurationMs(elapsed);
      if (shouldAutoFinishMeeting(meetingStartedAtRef.current, Date.now())) finish("Limite máximo de 5 horas atingido. A reunião foi finalizada automaticamente.");
    }, 1000);
    autosaveRef.current = window.setInterval(() => { void autosaveMeetingProgress(); }, 15000);
    setStatus("recording");
  };

  const pause = () => { recognitionManuallyStoppedRef.current = true; shouldKeepRecognitionAliveRef.current = false; recognitionRef.current?.stop(); mediaRecorderRef.current?.pause(); setStatus("paused"); };
  const resume = () => { shouldKeepRecognitionAliveRef.current = true; recognitionManuallyStoppedRef.current = false; mediaRecorderRef.current?.resume(); try { recognitionRef.current?.start(); } catch {} setStatus("recording"); };

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (status === "recording" || status === "paused") { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [status]);

  return { status, permissionError, isSpeechSupported, interimTranscript, transcriptLines, manualTranscript, setManualTranscript, topicSummary, persistenceMode, durationMs, autosaveState, recognitionRestarted, recognitionUnstable, start, pause, resume, finish, autosaveMeetingProgress };
}
