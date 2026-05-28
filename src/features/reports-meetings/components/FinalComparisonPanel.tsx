interface Props {
  topicSummary: {
    decisions: string[];
    actions: string[];
    risks: string[];
    numbers: string[];
    points: string[];
  } | null;
}

export function FinalComparisonPanel({ topicSummary }: Props) {
  return (
    <div className="liquid-glass rounded-2xl p-4 md:p-5">
      <h3 className="text-base font-semibold">Resumo inteligente pós-reunião</h3>
      {!topicSummary ? (
        <p className="mt-2 text-sm text-muted-foreground">Finalize a reunião para separar automaticamente por tópicos, decisões e ideias.</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
          <Block title="Decisões" items={topicSummary.decisions} />
          <Block title="Ações" items={topicSummary.actions} />
          <Block title="Riscos" items={topicSummary.risks} />
          <Block title="Números mencionados" items={topicSummary.numbers} />
        </div>
      )}
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white/50 bg-white/60 p-3">
      <p className="font-medium mb-2">{title}</p>
      {items.length ? items.map((item, idx) => <p key={idx} className="text-muted-foreground mb-1">• {item}</p>) : <p className="text-muted-foreground">Sem itens detectados.</p>}
    </div>
  );
}
