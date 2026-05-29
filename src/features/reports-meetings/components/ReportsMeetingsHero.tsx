import { Loader2, Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportsMeetingsHero({
  onGenerate,
  onStartMeeting,
  isGenerating,
}: {
  onGenerate: () => void;
  onStartMeeting: () => void;
  isGenerating?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-white/70 p-6 shadow-sm backdrop-blur">
      <h1 className="text-2xl font-semibold">Relatorios e reunioes</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Prepare reunioes com dados reais, registre decisoes e transforme conversas em acoes recorrentes.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Gerar relatorio pre-reuniao
        </Button>
        <Button variant="outline" onClick={onStartMeeting}>
          <Mic className="h-4 w-4 mr-2" />
          Iniciar reuniao
        </Button>
      </div>
    </div>
  );
}
