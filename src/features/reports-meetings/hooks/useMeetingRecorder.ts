import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildTopicSummary,
  dedupeTranscriptSegments,
  detectMeetingInstability,
  sanitizeText,
  shouldAutoFinishMeeting,
  type OperationalEvent,
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

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0?: { transcript?: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

function devWarn(msg: string, e?: unknown) {
  if (import.meta.env.DEV) console.warn(`[meeting-recorder] ${msg}`, e);
}

function buildLocalSummary(transcript: string, title: string, operationalEvents: OperationalEvent[]) {
  const summary = buildTopicSummary(transcript, operationalEvents);
  const description = transcript.trim()
    ? `${title}: ${transcript.replace(/\s+/g, " ").slice(0, 220)}`
    : `${title}: reuniao sem transcricao capturada.`;
  const md = transcript.trim()
    ? [
        "## Resumo",
        summary.executiveSummary || transcript.slice(0, 320),
        summary.decisions.length ? "\n## Decisoes\n" + summary.decisions.map((d) => `- ${d}`).join("\n") : "",
        summary.actions.length ? "\n## Acoes\n" + summary.actions.map((a) => `- ${a}`).join("\n") : "",
        summary.clientRequests.length
          ? "\n## Solicitacoes do cliente\n" + summary.clientRequests.map((a) => `- ${a}`).join("\n")
          : "",
        summary.validationItems.length
          ? "\n## Conferencias pendentes\n" + summary.validationItems.map((a) => `- ${a}`).join("\n")
          : "",
        summary.numbers.length ? "\n## Numeros mencionados\n" + summary.numbers.map((n) => `- ${n}`).join("\n") : "",
        operationalEvents.length
          ? "\n## Status operacional\n" + operationalEvents.map((event) => `- ${event.message}`).join("\n")
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "## Resumo\n\nNenhuma fala foi capturada nesta reuniao.";
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
  const [autosaveState, setAutosaveState] = useState("Ainda nao salvo");
  const [recognitionRestarted, setRecognitionRestarted] = useState(false);
  const [recognitionUnstable, setRecognitionUnstable] = useState(false);
  const [finalizationStage, setFinalizationStage] = useState("inativo");
  const [operationalEvents, setOperationalEvents] = useState<OperationalEvent[]>([]);

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
  const operationalEventsRef = useRef<OperationalEvent[]>([]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
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

  const addOperationalEvent = (type: OperationalEvent["type"], message: string) => {
    const event = { type, message, at: new Date().toISOString() };
    operationalEventsRef.current = [...operationalEventsRef.current, event];
    setOperationalEvents(operationalEventsRef.current);
  };

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
    confirmedTranscriptRef.current = dedupeTranscriptSegments([...confirmedTranscriptRef.current, clean]);
    transcriptLinesRef.current = confirmedTranscriptRef.current;
    setTranscriptLines(transcriptLinesRef.current);
    setAutosaveState("Salvando...");
    return true;
  };

  const clearTimers = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (autosaveRef.current) window.clearInterval(autosaveRef.current);
    if (recognitionRestartTimeoutRef.current) window.clearTimeout(recognitionRestartTimeoutRef.current);
    timerRef.current = null;
    autosaveRef.current = null;
    recognitionRestartTimeoutRef.current = null;
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
        liveSegments: dedupeTranscriptSegments([...transcriptLinesRef.current, interimTranscript].filter(Boolean)),
        audioChunks: audioChunksRef.current,
        durationSeconds: Math.floor(durationMsRef.current / 1000),
        lastInterim: interimTranscript || undefined,
      });
      setAutosaveState("Salvo ha instantes");
    } catch (e) {
      devWarn("autosave falhou", e);
      addOperationalEvent("autosave_error", "Autosave falhou; copia local mantida.");
      setAutosaveState("Erro no autosave; copia local ativa");
    }
  }

  const stopMediaRecorderSafely = (timeoutMs = 4000): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return Promise.resolve(null);
    return new Promise((resolve) => {
      const chunks: BlobPart[] = [];
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || "audio/webm" }) : null);
      };
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
      } catch {
        /* requestData is best effort only */
      }
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
    setFinalizationStage("finalizando audio");
    if (recognitionRestartTimeoutRef.current) window.clearTimeout(recognitionRestartTimeoutRef.current);
    flushInterimIfRelevant();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* recognition may already be stopped */
    }

    await stopMediaRecorderSafely();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    clearTimers();
    await tryFlushPendingAudio();

    const transcriptText = buildFinalTranscriptFromRefs();
    const fallback =
      transcriptText ||
      "Nenhuma fala foi transcrita. Verifique microfone/permissao ou adicione a transcricao manualmente.";
    if (!transcriptText) addOperationalEvent("partial_finish", "Finalizacao parcial gerou resumo minimo.");
    const local = buildLocalSummary(fallback, "Reuniao", operationalEventsRef.current);
    const sid = meetingSessionIdRef.current;

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
        setFinalizationStage("concluido");
      } catch (e) {
        devWarn("finalize cloud falhou - mantendo resumo local", e);
        addOperationalEvent("backend_error", "Finalize em nuvem falhou; resumo local mantido.");
        setFinalizationStage("concluido localmente");
      }
      void requestEnhancedSummary(sid).then((ok) => {
        if (ok) {
          queryClient.invalidateQueries({ queryKey: ["meetings-library"] });
          queryClient.invalidateQueries({ queryKey: ["meeting-detail", sid] });
        }
      });
    } else {
      setFinalizationStage("concluido localmente");
    }

    setTopicSummary(local.summary);
    if (reason) setPermissionError(reason);
    setStatusSafe("idle");
    isFinishingRef.current = false;
    queryClient.invalidateQueries({ queryKey: ["meetings-library"] });
  };

  const start = async () => {
    setStatusSafe("idle");
    setPermissionError(null);
    setTranscriptLines([]);
    transcriptLinesRef.current = [];
    confirmedTranscriptRef.current = [];
    setInterimTranscript("");
    lastInterimTranscriptRef.current = "";
    setManualTranscript("");
    manualTranscriptRef.current = "";
    setTopicSummary(null);
    setDurationMs(0);
    durationMsRef.current = 0;
    setRecognitionRestarted(false);
    setRecognitionUnstable(false);
    setFinalizationStage("inativo");
    setOperationalEvents([]);
    operationalEventsRef.current = [];
    audioChunksRef.current = [];
    pendingAudioBlobsRef.current = [];
    chunkSeqRef.current = 0;

    let sessionId: string | null = null;
    let userId: string | null = null;
    if (import.meta.env.VITE_REPORTS_MEETINGS_E2E !== "1") {
      try {
        const created = await createCloudMeetingSession(`Reuniao ${new Date().toLocaleString("pt-BR")}`);
        sessionId = created.id;
        userId = created.userId;
      } catch (e) {
        devWarn("createCloudMeetingSession falhou - modo local", e);
        addOperationalEvent("backend_error", "Sessao em nuvem indisponivel; modo local ativado.");
      }
    } else {
      addOperationalEvent("fallback_local", "Modo E2E usa sessao local para teste deterministico.");
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
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia indisponivel");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (typeof MediaRecorder !== "undefined") {
        const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
          MediaRecorder.isTypeSupported?.(type),
        );
        mediaRecorderRef.current = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
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
      } else {
        addOperationalEvent("audio_unavailable", "MediaRecorder indisponivel; texto manual continua.");
      }
    } catch (e) {
      const message = "Nao foi possivel acessar o microfone. Fluxo manual/local continua disponivel.";
      setPermissionError(message);
      addOperationalEvent("audio_unavailable", message);
      addOperationalEvent("fallback_local", "Fallback local ativado por indisponibilidade de audio.");
      devWarn("getUserMedia falhou", e);
    }

    const speechCtor = getSpeechCtor();
    setIsSpeechSupported(Boolean(speechCtor));
    if (speechCtor) {
      const rec = new speechCtor();
      rec.lang = "pt-BR";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event: SpeechRecognitionEventLike) => {
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
              addOperationalEvent("recognition_restart", "Reconhecimento reiniciado automaticamente.");
            } catch {
              setRecognitionUnstable(true);
              addOperationalEvent("recognition_unstable", "Reconhecimento nao reiniciou; audio/manual mantidos.");
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
        addOperationalEvent("recognition_unstable", "Reconhecimento nao iniciou; audio/manual mantidos.");
      }
    } else {
      setPermissionError(
        "Transcricao em tempo real indisponivel neste dispositivo. Audio e texto manual continuam disponiveis.",
      );
      addOperationalEvent("fallback_local", "SpeechRecognition indisponivel; usar texto manual como seguranca.");
    }

    meetingStartedAtRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - meetingStartedAtRef.current;
      setDurationMs(elapsed);
      durationMsRef.current = elapsed;
      if (shouldAutoFinishMeeting(meetingStartedAtRef.current, Date.now())) {
        void finish("Limite maximo de 5 horas atingido. A reuniao foi finalizada automaticamente.");
      }
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
    } catch {
      /* recognition may already be stopped */
    }
    try {
      mediaRecorderRef.current?.pause();
    } catch {
      /* recorder may not support pause */
    }
    setStatusSafe("paused");
  };

  const resume = () => {
    isPausedRef.current = false;
    shouldKeepRecognitionAliveRef.current = true;
    recognitionManuallyStoppedRef.current = false;
    try {
      mediaRecorderRef.current?.resume();
    } catch {
      /* recorder may not support resume */
    }
    try {
      recognitionRef.current?.start();
    } catch {
      /* recognition may already be running */
    }
    setStatusSafe("recording");
  };

  const hasBackendSession = persistenceMode === "database" && Boolean(meetingSessionId);
  const operationalStatus = detectMeetingInstability({
    recognitionRestarted,
    recognitionUnstable,
    audioUnavailable: operationalEvents.some((event) => event.type === "audio_unavailable"),
    fallbackLocal: persistenceMode === "local",
    autosaveError: operationalEvents.some((event) => event.type === "autosave_error"),
    backendError: operationalEvents.some((event) => event.type === "backend_error"),
  }).status;

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
    operationalEvents,
    operationalStatus,
    start,
    pause,
    resume,
    finish,
    autosaveMeetingProgress,
  };
}
