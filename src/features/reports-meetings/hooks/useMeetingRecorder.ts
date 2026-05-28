import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildAutosavePayload, buildTopicSummary, dedupeTranscriptSegments, sanitizeText, shouldAutoFinishMeeting, type TopicSummary } from "../lib/meetingRecorderUtils";

const db = supabase as any;
export type MeetingStatus = "idle" | "recording" | "paused" | "finishing" | "blocked";
export type SessionPersistenceMode = "edge" | "database" | "local";

declare global { interface Window { webkitSpeechRecognition?: typeof SpeechRecognition; } }

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> => {
  let timeoutId: number | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(fallbackValue), timeoutMs);
  });
  const result = await Promise.race([promise, timeoutPromise]);
  if (timeoutId) window.clearTimeout(timeoutId);
  return result;
};

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
  const [finalizationStage, setFinalizationStage] = useState("inativo");

  const audioChunksRef = useRef<string[]>([]);
  const transcriptLinesRef = useRef<string[]>([]);
  const confirmedTranscriptRef = useRef<string[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const autosaveRef = useRef<number | null>(null);
  const autosaveInFlightRef = useRef<Promise<void> | null>(null);
  const meetingStartedAtRef = useRef<number>(0);
  const isFinishingRef = useRef(false);
  const isPausedRef = useRef(false);
  const shouldKeepRecognitionAliveRef = useRef(false);
  const recognitionRestartTimeoutRef = useRef<number | null>(null);
  const recognitionManuallyStoppedRef = useRef(false);
  const lastFinalTranscriptAtRef = useRef<number>(0);
  const lastInterimTranscriptRef = useRef("");

  const getSpeechCtor = () => (typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined);

  const appendTranscriptSegment = (text: string, _source: "speech-final" | "interim-flush" | "manual") => {
    const clean = sanitizeText(text);
    if (!clean) return false;
    const normalized = clean.toLocaleLowerCase("pt-BR");
    const exists = confirmedTranscriptRef.current.some((line) => sanitizeText(line).toLocaleLowerCase("pt-BR") === normalized);
    if (exists) return false;
    confirmedTranscriptRef.current = [...confirmedTranscriptRef.current, clean];
    transcriptLinesRef.current = [...transcriptLinesRef.current, clean];
    setTranscriptLines(transcriptLinesRef.current);
    setAutosaveState("Salvando...");
    return true;
  };

  const clearTimers = () => { if (timerRef.current) window.clearInterval(timerRef.current); if (autosaveRef.current) window.clearInterval(autosaveRef.current); if (recognitionRestartTimeoutRef.current) window.clearTimeout(recognitionRestartTimeoutRef.current); };
  const flushInterimIfRelevant = () => {
    const text = sanitizeText(lastInterimTranscriptRef.current || interimTranscript);
    if (text.length >= 4) appendTranscriptSegment(text, "interim-flush");
    lastInterimTranscriptRef.current = "";
    setInterimTranscript("");
  };

  const buildFinalTranscriptFromRefs = () => {
    const lines = [...confirmedTranscriptRef.current];
    const interim = sanitizeText(lastInterimTranscriptRef.current || interimTranscript);
    const manual = sanitizeText(manualTranscript);
    return dedupeTranscriptSegments([...lines, interim, manual].filter(Boolean)).join("\n");
  };

  async function autosaveMeetingProgress() {
    if (!meetingSessionId || persistenceMode === "local" || isFinishingRef.current) return;
    const transcript = buildFinalTranscriptFromRefs();
    const payload = buildAutosavePayload({ meeting_session_id: meetingSessionId, transcript_text: transcript, transcript_segments: transcriptLinesRef.current, live_transcript_segments: dedupeTranscriptSegments([...transcriptLinesRef.current, interimTranscript].filter(Boolean)), duration_seconds: Math.floor(durationMs / 1000), audio_chunks: audioChunksRef.current, last_interim_text: interimTranscript || undefined });
    autosaveInFlightRef.current = (async () => {
      try {
        await withTimeout(supabase.functions.invoke("reports-meetings-transcribe", { body: payload }), 5000, null as any);
        setAutosaveState("Salvo há instantes");
      } catch {
        setAutosaveState("Falha no autosave");
      }
    })();
    await autosaveInFlightRef.current;
    autosaveInFlightRef.current = null;
  }

  const stopMediaRecorderSafely = async (timeoutMs = 4000): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return null;
    return new Promise((resolve) => {
      const chunks: BlobPart[] = [];
      const finish = () => resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || "audio/webm" }) : null);
      const timer = window.setTimeout(finish, timeoutMs);
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      recorder.onstop = () => { window.clearTimeout(timer); finish(); };
      try { recorder.requestData?.(); } catch {}
      try { if (recorder.state !== "inactive") recorder.stop(); else { window.clearTimeout(timer); finish(); } } catch { window.clearTimeout(timer); finish(); }
    });
  };

  const finish = async (reason?: string) => {
    if (!meetingSessionId || isFinishingRef.current) return;
    isFinishingRef.current = true;
    shouldKeepRecognitionAliveRef.current = false;
    recognitionManuallyStoppedRef.current = true;
    setStatus("finishing");
    setFinalizationStage("finalizando áudio");
    if (recognitionRestartTimeoutRef.current) window.clearTimeout(recognitionRestartTimeoutRef.current);
    flushInterimIfRelevant();
    try { recognitionRef.current?.stop(); } catch {}
    const recordedBlob = await stopMediaRecorderSafely();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearTimers();
    await withTimeout(autosaveInFlightRef.current ?? Promise.resolve(), 2000, undefined);
    const transcriptText = buildFinalTranscriptFromRefs();
    const fallbackText = transcriptText || "Nenhuma fala foi transcrita. Verifique microfone/permissão ou cole a transcrição manualmente.";
    const summary = buildTopicSummary(fallbackText);
    let finalized = false;
    setFinalizationStage("salvando transcrição");
    try {
      await withTimeout(supabase.functions.invoke("reports-meetings-transcribe", { body: { action: "finalize_session", meeting_session_id: meetingSessionId, transcript_text: fallbackText, audio_chunks: audioChunksRef.current, duration_seconds: Math.floor(durationMs / 1000), audio_storage_path: recordedBlob ? `local-${Date.now()}` : undefined } }), 10000, null as any);
      finalized = true;
    } catch {}
    if (!finalized) {
      try {
        await withTimeout(db.from("meeting_sessions").update({ status: "finished", ended_at: new Date().toISOString(), transcript_text: fallbackText, transcript_segments: dedupeTranscriptSegments(fallbackText.split("\n")), action_items: summary.actions, decisions: summary.decisions, mentioned_numbers: summary.numbers, audio_chunks: audioChunksRef.current, duration_seconds: Math.floor(durationMs / 1000) }).eq("id", meetingSessionId), 8000, null as any);
        finalized = true;
      } catch {}
    }
    setFinalizationStage(finalized ? "concluído" : "finalizado localmente por falha no backend");
    if (reason) setPermissionError(reason);
    setTopicSummary(summary);
    setStatus("idle");
    isFinishingRef.current = false;
  };

  const start = async () => {
    setStatus("idle"); setPermissionError(null); setTranscriptLines([]); transcriptLinesRef.current = []; confirmedTranscriptRef.current = []; setInterimTranscript(""); lastInterimTranscriptRef.current = ""; setManualTranscript(""); setDurationMs(0); setRecognitionRestarted(false); setRecognitionUnstable(false); setFinalizationStage("inativo");
    const { data } = await supabase.functions.invoke("reports-meetings-transcribe", { body: { action: "start_session", title: `Reunião ${new Date().toLocaleString("pt-BR")}` } });
    const sessionId = data?.meeting_session_id;
    setMeetingSessionId(sessionId); setPersistenceMode("edge");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    if (typeof MediaRecorder !== "undefined") {
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported?.(t));
      mediaRecorderRef.current = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (!event.data?.size || !sessionId) return;
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData.user?.id ?? "anon";
        const filePath = `${uid}/${sessionId}/audio/chunk-${Date.now()}.webm`;
        const { error } = await withTimeout(supabase.storage.from("meeting-reports").upload(filePath, event.data, { upsert: true, contentType: event.data.type || "audio/webm" }), 8000, { error: new Error("timeout") } as any);
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
          if (result.isFinal) { appendTranscriptSegment(text, "speech-final"); lastFinalTranscriptAtRef.current = Date.now(); }
          else interim = `${interim} ${text}`.trim();
        }
        lastInterimTranscriptRef.current = interim;
        setInterimTranscript(interim);
      };
      rec.onend = () => {
        flushInterimIfRelevant();
        const canRestart = status === "recording" && shouldKeepRecognitionAliveRef.current && !isFinishingRef.current && !isPausedRef.current && !recognitionManuallyStoppedRef.current && !shouldAutoFinishMeeting(meetingStartedAtRef.current, Date.now());
        if (canRestart) {
          recognitionRestartTimeoutRef.current = window.setTimeout(() => { try { rec.start(); setRecognitionRestarted(true); } catch { setRecognitionUnstable(true); } }, 700);
        }
      };
      recognitionRef.current = rec; shouldKeepRecognitionAliveRef.current = true; recognitionManuallyStoppedRef.current = false; try { rec.start(); } catch { setRecognitionUnstable(true); }
    } else {
      setPermissionError("Transcrição em tempo real indisponível neste dispositivo. A gravação de áudio e texto manual continuam disponíveis.");
    }

    meetingStartedAtRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - meetingStartedAtRef.current;
      setDurationMs(elapsed);
      if (shouldAutoFinishMeeting(meetingStartedAtRef.current, Date.now())) void finish("Limite máximo de 5 horas atingido. A reunião foi finalizada automaticamente.");
    }, 1000);
    autosaveRef.current = window.setInterval(() => { void autosaveMeetingProgress(); }, 15000);
    isPausedRef.current = false;
    setStatus("recording");
  };

  const pause = () => { isPausedRef.current = true; flushInterimIfRelevant(); recognitionManuallyStoppedRef.current = true; shouldKeepRecognitionAliveRef.current = false; recognitionRef.current?.stop(); mediaRecorderRef.current?.pause(); setStatus("paused"); };
  const resume = () => { isPausedRef.current = false; shouldKeepRecognitionAliveRef.current = true; recognitionManuallyStoppedRef.current = false; mediaRecorderRef.current?.resume(); try { recognitionRef.current?.start(); } catch {} setStatus("recording"); };

  useEffect(() => { transcriptLinesRef.current = transcriptLines; }, [transcriptLines]);

  return { status, permissionError, isSpeechSupported, interimTranscript, transcriptLines, manualTranscript, setManualTranscript, topicSummary, persistenceMode, durationMs, autosaveState, recognitionRestarted, recognitionUnstable, finalizationStage, start, pause, resume, finish, autosaveMeetingProgress };
}
