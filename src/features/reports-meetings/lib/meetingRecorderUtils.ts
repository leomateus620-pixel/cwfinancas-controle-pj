export const MAX_MEETING_DURATION_MS = 5 * 60 * 60 * 1000;

export const sanitizeText = (input: string) => input.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
export const normalizeText = (input: string) => sanitizeText(input).toLocaleLowerCase("pt-BR");

export interface OperationalEvent {
  type:
    | "recognition_restart"
    | "recognition_unstable"
    | "audio_unavailable"
    | "fallback_local"
    | "autosave_error"
    | "backend_error"
    | "partial_finish";
  message: string;
  at: string;
}

export function dedupeTranscriptSegments(values: string[]) {
  const accepted: string[] = [];
  const keys: string[] = [];

  for (const item of values) {
    const clean = cleanTranscriptSegment(item);
    const key = normalizeText(clean);
    if (!key) continue;
    const duplicate = keys.some((existing) => {
      if (existing === key) return true;
      if (key.length > 24 && existing.includes(key)) return true;
      if (existing.length > 24 && key.includes(existing)) return true;
      return similarity(existing, key) > 0.92;
    });
    if (duplicate) continue;
    accepted.push(clean);
    keys.push(key);
  }

  return accepted;
}

export function buildFinalTranscript(lines: string[], interim: string, manual: string) {
  return cleanTranscriptSegments([...lines, interim, manual]).join("\n");
}

export function shouldAutoFinishMeeting(startedAt: number, now = Date.now()) {
  return now - startedAt >= MAX_MEETING_DURATION_MS;
}

export function buildAutosavePayload(params: {
  meeting_session_id: string;
  transcript_text: string;
  transcript_segments: string[];
  live_transcript_segments: string[];
  duration_seconds: number;
  audio_chunks?: string[];
  last_interim_text?: string;
}) {
  return {
    action: "autosave_session",
    ...params,
  };
}

export interface TopicSummary {
  executiveSummary: string;
  nextSteps: string[];
  openQuestions: string[];
  financialMentions: string[];
  decisions: string[];
  actions: string[];
  risks: string[];
  numbers: string[];
  points: string[];
  owners: string[];
  dueDates: string[];
  clientRequests: string[];
  postMeetingDemands: string[];
  validationItems: string[];
  operationalStatus: "stable" | "attention" | "fallback";
  operationalEvents: OperationalEvent[];
}

export function buildTopicSummary(transcriptText: string, operationalEvents: OperationalEvent[] = []): TopicSummary {
  const parts = cleanTranscriptSegments(
    transcriptText
      .split(/[\n.!?]/)
      .map((x) => sanitizeText(x))
      .filter(Boolean),
  );

  if (parts.length < 2) {
    return {
      executiveSummary: "Dados insuficientes para gerar resumo completo da reuniao.",
      nextSteps: [],
      openQuestions: [],
      financialMentions: [],
      decisions: [],
      actions: [],
      risks: [],
      numbers: [],
      points: parts,
      owners: [],
      dueDates: [],
      clientRequests: [],
      postMeetingDemands: [],
      validationItems: [],
      operationalStatus: classifyOperationalStatus(operationalEvents),
      operationalEvents,
    };
  }

  const decisions = parts.filter((p) => /decidimos|ficou decidido|decisao|aprovado|combinado|definido/i.test(normalizeText(p)));
  const actions = parts.filter((p) => /responsavel|precisa|vamos|prazo|entregar|ajustar|revisar|fazer|enviar|conferir/i.test(normalizeText(p)));
  const risks = parts.filter((p) => /risco|problema|atraso|bloqueio|inadimplencia|queda|preocupacao|falha|erro/i.test(normalizeText(p)));
  const numbers = parts.filter((p) => /\d|r\$|%|mil|milhao/i.test(normalizeText(p)));
  const openQuestions = parts.filter((p) => /\?$|como|quando|quem|qual|por que|porque/i.test(normalizeText(p)));
  const clientRequests = parts.filter((p) => /cliente|solicitou|solicitacao|pedido|pediu|quer|demanda/i.test(normalizeText(p)));
  const validationItems = parts.filter((p) => /validar|conferir|checar|confirmar|revisar|auditar/i.test(normalizeText(p)));
  const owners = extractOwners(parts);
  const dueDates = extractDueDates(parts);
  const nextSteps = dedupeTranscriptSegments(actions.slice(0, 8));

  return {
    executiveSummary: parts.slice(0, 3).join(". "),
    nextSteps,
    openQuestions,
    financialMentions: numbers,
    decisions,
    actions,
    risks,
    numbers,
    points: parts,
    owners,
    dueDates,
    clientRequests,
    postMeetingDemands: dedupeTranscriptSegments([...clientRequests, ...actions].slice(0, 10)),
    validationItems,
    operationalStatus: classifyOperationalStatus(operationalEvents),
    operationalEvents,
  };
}

export function cleanTranscriptSegments(values: string[]) {
  return dedupeTranscriptSegments(
    values
      .flatMap((value) => String(value ?? "").split(/\n+/))
      .map(cleanTranscriptSegment)
      .filter(Boolean),
  );
}

export function cleanTranscriptSegment(value: string) {
  let clean = sanitizeText(value)
    .replace(/^(ana|joao|maria|cliente|consultor|participante\s*\d+)\s*:\s*/i, "")
    .replace(/\b(hum|ahn|eh|tipo)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  clean = removeRepeatedTail(removeConsecutiveDuplicateWords(clean));
  return clean;
}

export function detectMeetingInstability(params: {
  recognitionRestarted?: boolean;
  recognitionUnstable?: boolean;
  audioUnavailable?: boolean;
  fallbackLocal?: boolean;
  autosaveError?: boolean;
  backendError?: boolean;
  partialFinish?: boolean;
}) {
  const events: OperationalEvent[] = [];
  const add = (type: OperationalEvent["type"], message: string) =>
    events.push({ type, message, at: new Date().toISOString() });

  if (params.recognitionRestarted) add("recognition_restart", "Reconhecimento reiniciado automaticamente.");
  if (params.recognitionUnstable) add("recognition_unstable", "Reconhecimento de fala oscilou durante a reuniao.");
  if (params.audioUnavailable) add("audio_unavailable", "Audio ou microfone indisponivel; fluxo manual mantido.");
  if (params.fallbackLocal) add("fallback_local", "Fallback local ativado para nao bloquear a reuniao.");
  if (params.autosaveError) add("autosave_error", "Autosave falhou; copia local mantida.");
  if (params.backendError) add("backend_error", "Backend indisponivel temporariamente.");
  if (params.partialFinish) add("partial_finish", "Finalizacao parcial gerou resumo util com dados disponiveis.");

  return {
    events,
    status: classifyOperationalStatus(events),
  };
}

export function classifyOperationalStatus(events: OperationalEvent[]): TopicSummary["operationalStatus"] {
  if (events.some((event) => event.type === "fallback_local" || event.type === "audio_unavailable")) return "fallback";
  if (events.length) return "attention";
  return "stable";
}

function removeRepeatedTail(value: string) {
  const words = value.split(" ");
  if (words.length < 6) return value;
  const half = Math.floor(words.length / 2);
  for (let size = Math.min(8, half); size >= 2; size--) {
    const tail = words.slice(-size).join(" ").toLowerCase();
    const beforeTail = words.slice(-size * 2, -size).join(" ").toLowerCase();
    if (tail && tail === beforeTail) return words.slice(0, -size).join(" ");
  }
  return value;
}

function removeConsecutiveDuplicateWords(value: string) {
  const words = value.split(" ");
  return words.filter((word, index) => index === 0 || normalizeText(word) !== normalizeText(words[index - 1])).join(" ");
}

function similarity(a: string, b: string) {
  const wordsA = new Set(a.split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.split(/\s+/).filter(Boolean));
  if (!wordsA.size || !wordsB.size) return 0;
  const intersection = [...wordsA].filter((word) => wordsB.has(word)).length;
  return intersection / Math.max(wordsA.size, wordsB.size);
}

function extractOwners(parts: string[]) {
  const owners = parts.flatMap((part) => {
    const matches = [...part.matchAll(/\b([A-Z][\w-]{2,})\b(?=.*\b(responsavel|vai|deve|ficou|entregar|revisar)\b)/gi)];
    return matches.map((match) => match[1]);
  });
  return dedupeTranscriptSegments(owners).slice(0, 8);
}

function extractDueDates(parts: string[]) {
  const dueDates = parts.flatMap((part) => {
    const matches = [
      ...part.matchAll(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g),
      ...part.matchAll(/\b(hoje|amanha|sexta|segunda|terca|quarta|quinta|proxima semana|fim do mes)\b/gi),
    ];
    return matches.map((match) => match[0]);
  });
  return dedupeTranscriptSegments(dueDates).slice(0, 8);
}
