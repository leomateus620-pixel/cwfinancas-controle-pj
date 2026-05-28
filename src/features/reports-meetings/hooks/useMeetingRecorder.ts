import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildTopicSummary,
  dedupeTranscriptSegments,
  sanitizeText,
  shouldAutoFinishMeeting,
  type TopicSummary,
} from "../lib/meetingRecorderUtils";
import {
  autosaveCloudMeetingSession,
  createCloudMeetingSession,
  finalizeCloudMeetingSession,
  requestEnhancedSummary,
  uploadMeetingAudioChunk,
  type AudioChunkMeta,
} from "../lib/meetingCloudRepository";

export type MeetingStatus = "idle" | "recording" | "paused" | "finishing" | "blocked";
export type SessionPersistenceMode = "database" | "local";

type SpeechRecognitionCtor = new () => any;
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

function devWarn(msg: string, e?: unknown) {
  if (import.meta.env.DEV) console.warn(`[meeting-recorder] ${msg}`, e);
}

function buildLocalSummary(transcript: string, title: string) {
  const summary = buildTopicSummary(transcript);
  const description = transcript.trim()
    ? `${title}: ${transcript.replace(/\s+/g, " ").slice(0, 220)}`
    : `${title}: reunião sem transcrição capturada.`;
  const md = transcript.trim()
    ? [
        "## Resumo",
        summary.executiveSummary || transcript.slice(0, 320),
        summary.decisions.length ? "\n## Decisões\n" + summary.decisions.map((d) => `- ${d}`).join("\n") : "",
        summary.actions.length ? "\n## Ações\n" + summary.actions.map((a) => `- ${a}`).join("\n") : "",
        summary.numbers.length ? "\n## Números mencionados\n" + summary.numbers.map((n) => `- ${n}`).join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "## Resumo\n\nNenhuma fala foi capturada nesta reunião.";
  return { description, summaryMarkdown: md, summary };
}

export function useMeetingRecorder() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MeetingStatus>("idle");
  const statusRef = useRef<MeetingStatus>("idle");
  const setStatusSafe = (next: MeetingStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

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

  const meetingSessionIdRef = useRef<string | null>(null);
  const persistenceModeRef = useRef<SessionPersistenceMode | null>(null);
  const userIdRef = useRef<string | null>(null);
  const durationMsRef = useRef(0);
  const manualTranscriptRef = useRef("");
  const audioChunksRef = useRef<AudioChunkMeta[]>([]);
  const pendingAudioBlobsRef = useRef<{ blob: Blob; sequence: number }[]>([]);
  const chunkSeqRef = useRef(0);
  const transcriptLinesRef = useRef<string[]>([]);
  const confirmedTranscriptRef = useRef<string[]>([]);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const autosaveRef = useRef<number | null>(null);
  const meetingStartedAtRef = useRef<number>(0);
  const isFinishingRef = useRef(false);
  const isPausedRef = useRef(false);
  const shouldKeepRecognitionAliveRef = useRef(false);
  const recognitionRestartTimeoutRef = useRef<number | null>(null);
  const recognitionManuallyStoppedRef = useRef(false);
  const lastInterimTranscriptRef = useRef("");

  useEffect(() => {
    manualTranscriptRef.current = manualTranscript;
  }, [manualTranscript]);

  const getSpeechCtor = () =>
    typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;

  const appendTranscriptSegment = (text: string) => {
    const clean = sanitizeText(text);
    if (!clean) return false;
    const normalized = clean.toLocaleLowerCase("pt-BR");
    const exists = confirmedTranscriptRef.current.some(
      (line) => sanitizeText(line).toLocaleLowerCase("pt-BR") === normalized,
    );
    if (exists) return false;
    confirmedTranscriptRef.current = [...confirmedTranscriptRef.current, clean];
    transcriptLinesRef.current = [...transcriptLinesRef.current, clean];
    setTranscriptLines(transcriptLinesRef.current);
    setAutosaveState("Salvando...");
    return true;
  };

  const clearTimers = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (autosaveRef.current) window.clearInterval(autosaveRef.current);
    if (recognitionRestartTimeoutRef.current) window.clearTimeout(recognitionRestartTimeoutRef.current);
  };

  const flushInterimIfRelevant = () => {
    const text = sanitizeText(lastInterimTranscriptRef.current || interimTranscript);
    if (text.length >= 4) appendTranscriptSegment(text);
    lastInterimTranscriptRef.current = "";
    setInterimTranscript("");
  };

  const buildFinalTranscriptFromRefs = () => {
    const lines = [...confirmedTranscriptRef.current];
    const interim = sanitizeText(lastInterimTranscriptRef.current || interimTranscript);
    const manual = sanitizeText(manualTranscriptRef.current);
    return dedupeTranscriptSegments([...lines, interim, manual].filter(Boolean)).join("\n");
  };

  const tryFlushPendingAudio = async () => {
    if (!userIdRef.current || !meetingSessionIdRef.current) return;
    const pending = [...pendingAudioBlobsRef.current];
    pendingAudioBlobsRef.current = [];
    for (const item of pending) {
      const meta = await uploadMeetingAudioChunk({
        meetingSessionId: meetingSessionIdRef.current,
        userId: userIdRef.current,
        blob: item.blob,
        sequence: item.sequence,
      });
      if (meta) audioChunksRef.current = [...audioChunksRef.current, meta];
      else pendingAudioBlobsRef.current.push(item);
    }
  };

  async function autosaveMeetingProgress() {
    const sid = meetingSessionIdRef.current;
    if (!sid || persistenceModeRef.current !== "database" || isFinishingRef.current) return;
    await tryFlushPendingAudio();
    const transcript = buildFinalTranscriptFromRefs();
    try {
      await autosaveCloudMeetingSession({
        meetingSessionId: sid,
        transcriptText: transcript,
        transcriptSegments: transcriptLinesRef.current,
        liveSegments: dedupeTranscriptSegments(
          [...transcriptLinesRef.current, interimTranscript].filter(Boolean),
        ),
        audioChunks: audioChunksRef.current,
        durationSeconds: Math.floor(durationMsRef.current / 1000),
        lastInterim: interimTranscript || undefined,
      });
      setAutosaveState("Salvo há instantes");
    } catch (e) {
      devWarn("autosave falhou", e);
      setAutosaveState("Salvando...");
    }
  }

  const stopMediaRecorderSafely = (timeoutMs = 4000): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return Promise.resolve(null);
    return new Promise((resolve) => {
      const chunks: BlobPart[] = [];
      const finish = () =>
        resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || "audio/webm" }) : null);
      const timer = window.setTimeout(finish, timeoutMs);
      recorder.addEventListener("dataavailable", (event: BlobEvent) => {
        if (event.data?.size) chunks.push(event.data);
      });
      const prevOnStop = recorder.onstop;
      recorder.onstop = () => {
        window.clearTimeout(timer);
        finish();
        if (typeof prevOnStop === "function") prevOnStop.call(recorder, new Event("stop"));
      };
      try {
        recorder.requestData?.();
      } catch {}
      try {
        if (recorder.state !== "inactive") recorder.stop();
        else {
          window.clearTimeout(timer);
          finish();
        }
      } catch {
        window.clearTimeout(timer);
        finish();
      }
    });
  };

  const finish = async (reason?: string) => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    shouldKeepRecognitionAliveRef.current = false;
    recognitionManuallyStoppedRef.current = true;
    setStatusSafe("finishing");
    setFinalizationStage("finalizando áudio");
    if (recognitionRestartTimeoutRef.current) window.clearTimeout(recognitionRestartTimeoutRef.current);
    flushInterimIfRelevant();
    try {
      recognitionRef.current?.stop();
    } catch {}

    await stopMediaRecorderSafely();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearTimers();

    // Final attempt to upload any pending audio
    await tryFlushPendingAudio();

    const transcriptText = buildFinalTranscriptFromRefs();
    const fallback =
      transcriptText ||
      "Nenhuma fala foi transcrita. Verifique microfone/permissão ou adicione a transcrição manualmente.";
    const sid = meetingSessionIdRef.current;
    const local = buildLocalSummary(fallback, "Reunião");

    if (sid && persistenceModeRef.current === "database") {
      setFinalizationStage("salvando na nuvem");
      try {
        await finalizeCloudMeetingSession({
          meetingSessionId: sid,
          transcriptText: fallback,
          transcriptSegments: dedupeTranscriptSegments(fallback.split("\n")),
          audioChunks: audioChunksRef.current,
          durationSeconds: Math.floor(durationMsRef.current / 1000),
          description: local.description,
          summaryMarkdown: local.summaryMarkdown,
          actionItems: local.summary.actions,
          decisions: local.summary.decisions,
          mentionedNumbers: local.summary.numbers,
        });
        setFinalizationStage("concluído");
      } catch (e) {
        devWarn("finalize cloud falhou — mantendo resumo local", e);
        setFinalizationStage("concluído");
      }
      // Optional AI refinement, completely non-blocking
      void requestEnhancedSummary(sid).then((ok) => {
        if (ok) {
          queryClient.invalidateQueries({ queryKey: ["meetings-library"] });
          queryClient.invalidateQueries({ queryKey: ["meeting-detail", sid] });
        }
      });
    } else {
      setFinalizationStage("concluído localmente");
    }

    setTopicSummary(local.summary);
    if (reason) setPermissionError(reason);
    setStatusSafe("idle");
    isFinishingRef.current = false;
    queryClient.invalidateQueries({ queryKey: ["meetings-library"] });
  };

  const start = async () => {
    setStatus("idle");
    setPermissionError(null);
    setTranscriptLines([]);
    transcriptLinesRef.current = [];
    confirmedTranscriptRef.current = [];
    setInterimTranscript("");
    lastInterimTranscriptRef.current = "";
    setManualTranscript("");
    manualTranscriptRef.current = "";
    setDurationMs(0);
    durationMsRef.current = 0;
    setRecognitionRestarted(false);
    setRecognitionUnstable(false);
    setFinalizationStage("inativo");
    audioChunksRef.current = [];
    pendingAudioBlobsRef.current = [];
    chunkSeqRef.current = 0;

    // Primary path: create session directly in DB
    let sessionId: string | null = null;
    let userId: string | null = null;
    try {
      const created = await createCloudMeetingSession(`Reunião ${new Date().toLocaleString("pt-BR")}`);
      sessionId = created.id;
      userId = created.userId;
    } catch (e) {
      devWarn("createCloudMeetingSession falhou — modo local", e);
    }

    meetingSessionIdRef.current = sessionId;
    userIdRef.current = userId;
    setMeetingSessionId(sessionId);
    if (sessionId) {
      persistenceModeRef.current = "database";
      setPersistenceMode("database");
    } else {
      persistenceModeRef.current = "local";
      setPersistenceMode("local");
    }
    queryClient.invalidateQueries({ queryKey: ["meetings-library"] });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (typeof MediaRecorder !== "undefined") {
        const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
          MediaRecorder.isTypeSupported?.(t),
        );
        mediaRecorderRef.current = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        mediaRecorderRef.current.ondataavailable = async (event) => {
          if (!event.data?.size) return;
          const sid = meetingSessionIdRef.current;
          const uid = userIdRef.current;
          if (!sid || !uid || persistenceModeRef.current !== "database") return;
          const sequence = ++chunkSeqRef.current;
          const meta = await uploadMeetingAudioChunk({
            meetingSessionId: sid,
            userId: uid,
            blob: event.data,
            sequence,
          });
          if (meta) audioChunksRef.current = [...audioChunksRef.current, meta];
          else pendingAudioBlobsRef.current.push({ blob: event.data, sequence });
        };
        mediaRecorderRef.current.start(30000);
      }
    } catch (e) {
      setPermissionError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
      devWarn("getUserMedia falhou", e);
      return;
    }

    const speechCtor = getSpeechCtor();
    setIsSpeechSupported(Boolean(speechCtor));
    if (speechCtor) {
      const rec = new speechCtor();
      rec.lang = "pt-BR";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = sanitizeText(result[0]?.transcript ?? "");
          if (result.isFinal) appendTranscriptSegment(text);
          else interim = `${interim} ${text}`.trim();
        }
        lastInterimTranscriptRef.current = interim;
        setInterimTranscript(interim);
      };
      rec.onend = () => {
        flushInterimIfRelevant();
        const canRestart =
          statusRef.current === "recording" &&
          shouldKeepRecognitionAliveRef.current &&
          !isFinishingRef.current &&
          !isPausedRef.current &&
          !recognitionManuallyStoppedRef.current &&
          !shouldAutoFinishMeeting(meetingStartedAtRef.current, Date.now());
        if (canRestart) {
          recognitionRestartTimeoutRef.current = window.setTimeout(() => {
            try {
              rec.start();
              setRecognitionRestarted(true);
            } catch {
              setRecognitionUnstable(true);
            }
          }, 700);
        }
      };
      recognitionRef.current = rec;
      shouldKeepRecognitionAliveRef.current = true;
      recognitionManuallyStoppedRef.current = false;
      try {
        rec.start();
      } catch {
        setRecognitionUnstable(true);
      }
    } else {
      setPermissionError(
        "Transcrição em tempo real indisponível neste dispositivo. A gravação de áudio e texto manual continuam disponíveis.",
      );
    }

    meetingStartedAtRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - meetingStartedAtRef.current;
      setDurationMs(elapsed);
      durationMsRef.current = elapsed;
      if (shouldAutoFinishMeeting(meetingStartedAtRef.current, Date.now()))
        void finish("Limite máximo de 5 horas atingido. A reunião foi finalizada automaticamente.");
    }, 1000);
    autosaveRef.current = window.setInterval(() => {
      void autosaveMeetingProgress();
    }, 15000);
    isPausedRef.current = false;
    setStatusSafe("recording");
  };

  const pause = () => {
    isPausedRef.current = true;
    flushInterimIfRelevant();
    recognitionManuallyStoppedRef.current = true;
    shouldKeepRecognitionAliveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {}
    try {
      mediaRecorderRef.current?.pause();
    } catch {}
    setStatusSafe("paused");
  };

  const resume = () => {
    isPausedRef.current = false;
    shouldKeepRecognitionAliveRef.current = true;
    recognitionManuallyStoppedRef.current = false;
    try {
      mediaRecorderRef.current?.resume();
    } catch {}
    try {
      recognitionRef.current?.start();
    } catch {}
    setStatusSafe("recording");
  };

  const hasBackendSession = persistenceMode === "database" && Boolean(meetingSessionId);

  return {
    status,
    permissionError,
    isSpeechSupported,
    interimTranscript,
    transcriptLines,
    manualTranscript,
    setManualTranscript,
    topicSummary,
    persistenceMode,
    meetingSessionId,
    hasBackendSession,
    durationMs,
    autosaveState,
    recognitionRestarted,
    recognitionUnstable,
    finalizationStage,
    start,
    pause,
    resume,
    finish,
    autosaveMeetingProgress,
  };
}
