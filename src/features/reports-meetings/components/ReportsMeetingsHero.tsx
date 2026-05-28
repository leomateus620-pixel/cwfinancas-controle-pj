import { Button } from "@/components/ui/button";

export function ReportsMeetingsHero({ onGenerate, onStartMeeting }: { onGenerate: () => void; onStartMeeting: () => void }) {
  return <div className="rounded-2xl border bg-white/70 p-6 shadow-sm backdrop-blur"><h1 className="text-2xl font-semibold">Relatórios e reuniões</h1><p className="text-sm text-muted-foreground mt-1">Prepare reuniões com dados reais, registre decisões e transforme conversas em ações.</p><div className="mt-4 flex gap-2"><Button onClick={onGenerate}>Gerar relatório pré-reunião</Button><Button variant="outline" onClick={onStartMeeting}>Iniciar reunião</Button></div></div>;
}
