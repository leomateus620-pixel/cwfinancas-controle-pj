import type { TopicSummary } from "../lib/meetingRecorderUtils";
import type { ConsolidatedMeetingReport } from "../lib/meetingComparison";

interface Props {
  topicSummary: TopicSummary | null;
  comparison: ConsolidatedMeetingReport | null;
}

export function FinalComparisonPanel({ topicSummary, comparison }: Props) {
  if (!topicSummary) {
    return (
      <div className="liquid-glass rounded-2xl p-4 md:p-5">
        <h3 className="text-base font-semibold">Resumo inteligente pos-reuniao</h3>
        <p className="mt-2 text-sm text-muted-foreground">Finalize a reuniao para gerar o resumo completo.</p>
      </div>
    );
  }

  return (
    <div className="liquid-glass rounded-2xl p-4 md:p-5">
      <h3 className="text-base font-semibold">Resumo inteligente pos-reuniao</h3>
      <p className="mt-2 text-sm">{topicSummary.executiveSummary}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {[
          ["Decisoes", topicSummary.decisions],
          ["Acoes", topicSummary.actions],
          ["Solicitacoes", topicSummary.clientRequests],
          ["Conferencias", topicSummary.validationItems],
          ["Riscos", topicSummary.risks],
          ["Numeros", topicSummary.numbers],
        ].map(([label, items]) => (
          <TopicList key={String(label)} label={String(label)} items={items as string[]} />
        ))}
      </div>

      {comparison && (
        <div className="mt-4 rounded-xl border border-white/50 bg-white/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold">Comparacao relatorio x reuniao</h4>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
              alinhamento {comparison.alignmentScore}%
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{comparison.financialSummary}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <TopicList label="Previstos discutidos" items={comparison.discussedAgenda} />
            <TopicList label="Previstos pendentes" items={comparison.missingAgenda} />
            <TopicList label="Divergencias" items={comparison.divergences} />
            <TopicList label="Prioridades" items={comparison.priorities} />
          </div>
        </div>
      )}
    </div>
  );
}

function TopicList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white/50 bg-white/60 p-3 text-sm">
      <p className="mb-2 font-medium">{label}</p>
      {items.length ? (
        items.map((item, index) => <p key={`${label}-${index}`}>- {item}</p>)
      ) : (
        <p className="text-muted-foreground">Sem itens detectados.</p>
      )}
    </div>
  );
}
