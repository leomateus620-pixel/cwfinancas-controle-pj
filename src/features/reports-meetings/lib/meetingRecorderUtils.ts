export const MAX_MEETING_DURATION_MS = 5 * 60 * 60 * 1000;

export const sanitizeText = (input: string) => input.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
export const normalizeText = (input: string) => sanitizeText(input).toLocaleLowerCase("pt-BR");

export function dedupeTranscriptSegments(values: string[]) {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = normalizeText(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildFinalTranscript(lines: string[], interim: string, manual: string) {
  return dedupeTranscriptSegments([...lines, interim, manual].map(sanitizeText).filter(Boolean)).join("\n");
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
}

export function buildTopicSummary(transcriptText: string): TopicSummary {
  const parts = dedupeTranscriptSegments(
    transcriptText
      .split(/[\n\.\!\?]/)
      .map((x) => sanitizeText(x))
      .filter(Boolean),
  );

  if (parts.length < 2) {
    return {
      executiveSummary: "Dados insuficientes para gerar resumo completo da reunião.",
      nextSteps: [] as string[],
      openQuestions: [] as string[],
      financialMentions: [] as string[],
      decisions: [] as string[],
      actions: [] as string[],
      risks: [] as string[],
      numbers: [] as string[],
      points: parts,
    };
  }

  const decisions = parts.filter((p) => /decidimos|ficou decidido|decisão|decisao|aprovado/i.test(p));
  const actions = parts.filter((p) => /responsável|responsavel|precisa|vamos|prazo|entregar|ajustar|revisar|fazer/i.test(p));
  const risks = parts.filter((p) => /risco|problema|atraso|bloqueio|inadimplência|inadimplencia|queda|preocupação|preocupacao/i.test(p));
  const numbers = parts.filter((p) => /\d|r\$|%|mil|milhão|milhao/i.test(p));
  const openQuestions = parts.filter((p) => /\?$|como|quando|quem|qual/i.test(p));
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
  };
}
