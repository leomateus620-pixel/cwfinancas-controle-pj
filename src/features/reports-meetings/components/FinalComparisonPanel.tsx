import type { ReactNode } from "react";
import { AlertCircle, CheckSquare, ClipboardList, MessageSquareText, Target } from "lucide-react";
import type { TopicSummary } from "../lib/meetingRecorderUtils";
import type { ConsolidatedMeetingReport } from "../lib/meetingComparison";
import { GlassPanel, StatusBadge } from "./reportsMeetingUi";

interface Props {
  topicSummary: TopicSummary | null;
  comparison: ConsolidatedMeetingReport | null;
}

export function FinalComparisonPanel({ topicSummary, comparison }: Props) {
  if (!topicSummary) {
    return (
      <GlassPanel>
        <h3 className="text-lg font-bold tracking-tight text-slate-950">Resumo inteligente pós-reunião</h3>
        <p className="mt-2 text-sm text-slate-600">Finalize a reunião para gerar decisões, ações e pendências em uma visão executiva.</p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-950">Resumo inteligente pós-reunião</h3>
          <p className="mt-2 text-sm leading-7 text-slate-700">{topicSummary.executiveSummary}</p>
        </div>
        {comparison && <StatusBadge tone="info">Alinhamento {comparison.alignmentScore}%</StatusBadge>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TopicList label="Decisões" items={topicSummary.decisions} icon={<CheckSquare className="h-4 w-4" />} />
        <TopicList label="Ações" items={topicSummary.actions} icon={<Target className="h-4 w-4" />} />
        <TopicList label="Solicitações do cliente" items={topicSummary.clientRequests} icon={<MessageSquareText className="h-4 w-4" />} />
        <TopicList label="Pontos de atenção" items={[...topicSummary.validationItems, ...topicSummary.risks]} icon={<AlertCircle className="h-4 w-4" />} />
        <TopicList label="Pendências" items={topicSummary.numbers} icon={<ClipboardList className="h-4 w-4" />} />
      </div>

      {comparison && (
        <div className="rounded-2xl border border-white/70 bg-white/58 p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-sm font-bold text-slate-950">Comparação relatório x reunião</h4>
            <StatusBadge tone="success">{comparison.alignmentScore}% de alinhamento</StatusBadge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{comparison.financialSummary}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <TopicList label="Previstos discutidos" items={comparison.discussedAgenda} icon={<CheckSquare className="h-4 w-4" />} compact />
            <TopicList label="Previstos pendentes" items={comparison.missingAgenda} icon={<ClipboardList className="h-4 w-4" />} compact />
            <TopicList label="Divergências" items={comparison.divergences} icon={<AlertCircle className="h-4 w-4" />} compact />
            <TopicList label="Prioridades" items={comparison.priorities} icon={<Target className="h-4 w-4" />} compact />
          </div>
        </div>
      )}
    </GlassPanel>
  );
}

function TopicList({ label, items, icon, compact }: { label: string; items: string[]; icon: ReactNode; compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/62 p-3 text-sm shadow-sm">
      <p className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      {items.length ? (
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <p key={`${label}-${index}`} className={compact ? "text-xs leading-relaxed text-slate-600" : "rounded-xl bg-white/70 px-3 py-2 leading-relaxed text-slate-700"}>
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">Sem itens detectados.</p>
      )}
    </div>
  );
}
