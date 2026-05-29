import type { PreMeetingReportPayload } from "./reportsMeetingTypes";
import type { TopicSummary } from "./meetingRecorderUtils";
import { normalizeText } from "./meetingRecorderUtils";
import { compareReportAndMeeting, detectMentionedNumbers } from "./meetingIntelligence";

export interface ConsolidatedMeetingReport {
  financialSummary: string;
  meetingSummary: string;
  discussedAgenda: string[];
  missingAgenda: string[];
  divergences: string[];
  clientRequests: string[];
  operationalActions: string[];
  accountingAttentionPoints: string[];
  manualValidationItems: string[];
  priorities: string[];
  nextSteps: string[];
  alignmentScore: number;
  generatedAt: string;
}

export function buildConsolidatedMeetingReport(params: {
  preMeetingReport: PreMeetingReportPayload;
  topicSummary: TopicSummary;
  transcriptText: string;
}): ConsolidatedMeetingReport {
  const { preMeetingReport, topicSummary, transcriptText } = params;
  const normalizedTranscript = normalizeText(transcriptText);
  const kpis = ((preMeetingReport.report_json.kpis as { label: string; value: number | null }[] | undefined) ?? [])
    .filter((kpi) => typeof kpi.value === "number");
  const mentionedNumbers = detectMentionedNumbers(transcriptText);
  const comparison = compareReportAndMeeting(kpis, mentionedNumbers);

  const agenda = preMeetingReport.suggested_agenda ?? [];
  const discussedAgenda = agenda.filter((item) => agendaWasDiscussed(item, normalizedTranscript));
  const missingAgenda = agenda.filter((item) => !agendaWasDiscussed(item, normalizedTranscript));
  const accountingAttentionPoints = topicSummary.points.filter((point) =>
    /imposto|nota|nf|fiscal|contabil|folha|pro labore|simples|dre|caixa/i.test(normalizeText(point)),
  );
  const manualValidationItems = [
    ...topicSummary.validationItems,
    ...missingAgenda.map((item) => `Nao discutido na reuniao: ${item}`),
    ...comparison.divergences.filter((item) => !/sem divergencia/i.test(normalizeText(item))),
  ];
  const priorities = buildPriorities({ comparison, topicSummary, missingAgenda, manualValidationItems });

  return {
    financialSummary: preMeetingReport.executive_summary,
    meetingSummary: topicSummary.executiveSummary,
    discussedAgenda,
    missingAgenda,
    divergences: comparison.divergences,
    clientRequests: topicSummary.clientRequests,
    operationalActions: topicSummary.actions,
    accountingAttentionPoints,
    manualValidationItems,
    priorities,
    nextSteps: dedupe([...topicSummary.nextSteps, ...priorities]),
    alignmentScore: comparison.alignmentScore,
    generatedAt: new Date().toISOString(),
  };
}

function agendaWasDiscussed(agendaItem: string, normalizedTranscript: string) {
  const keywords = normalizeText(agendaItem)
    .split(/\s+/)
    .filter((word) => word.length > 4 && !["reuniao", "periodo", "correto", "antes", "qualquer"].includes(word));
  if (!keywords.length) return false;
  const hits = keywords.filter((word) => normalizedTranscript.includes(word)).length;
  return hits / keywords.length >= 0.35;
}

function buildPriorities(params: {
  comparison: { alignmentScore: number; divergences: string[] };
  topicSummary: TopicSummary;
  missingAgenda: string[];
  manualValidationItems: string[];
}) {
  const priorities: string[] = [];
  if (params.comparison.alignmentScore < 60) priorities.push("Validar divergencias entre fala e numeros financeiros.");
  if (params.topicSummary.clientRequests.length) priorities.push("Transformar solicitacoes do cliente em demandas com responsavel.");
  if (params.missingAgenda.length) priorities.push("Retomar pontos previstos que nao foram discutidos.");
  if (params.manualValidationItems.length) priorities.push("Executar conferencia manual antes do proximo envio ao cliente.");
  if (!priorities.length) priorities.push("Registrar ata e acompanhar a execucao das acoes definidas.");
  return priorities;
}

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
