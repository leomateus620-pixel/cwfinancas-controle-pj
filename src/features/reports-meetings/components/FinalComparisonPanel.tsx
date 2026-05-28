import type { TopicSummary } from "../lib/meetingRecorderUtils";

interface Props { topicSummary: TopicSummary | null; }
export function FinalComparisonPanel({ topicSummary }: Props) {
  if (!topicSummary) return <div className="liquid-glass rounded-2xl p-4 md:p-5"><h3 className="text-base font-semibold">Resumo inteligente pós-reunião</h3><p className="mt-2 text-sm text-muted-foreground">Finalize a reunião para gerar o resumo completo.</p></div>;
  return <div className="liquid-glass rounded-2xl p-4 md:p-5"><h3 className="text-base font-semibold">Resumo inteligente pós-reunião</h3><p className="mt-2 text-sm">{topicSummary.executiveSummary}</p><div className="mt-3 grid gap-3 md:grid-cols-2">{["decisions","actions","risks","numbers","nextSteps","openQuestions"].map((k)=><div key={k} className="rounded-xl border border-white/50 bg-white/60 p-3 text-sm"><p className="mb-2 font-medium">{k}</p>{(topicSummary[k]||[]).length?topicSummary[k].map((i:string,idx:number)=><p key={idx}>• {i}</p>):<p className="text-muted-foreground">Sem itens detectados.</p>}</div>)}</div></div>;
}
