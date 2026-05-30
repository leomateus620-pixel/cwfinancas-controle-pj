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
    <section className="relative overflow-hidden mx-auto max-w-[1540px] rounded-[1.5rem] border border-white/75 bg-gradient-to-br from-white/88 via-blue-50/52 to-emerald-50/48 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.55),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl md:p-7">
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-blue-400/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-emerald-400/14 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/75">Central executiva</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Relatórios e reuniões</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 md:text-base">
            Prepare reuniões com dados reais, registre decisões e transforme conversas financeiras em ações recorrentes.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <Button onClick={onGenerate} disabled={isGenerating} className="h-11 rounded-xl shadow-[0_12px_30px_-16px_rgba(37,99,235,0.75)] transition-all hover:-translate-y-0.5 active:scale-[0.98]">
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Gerar relatório pré-reunião
          </Button>
          <Button variant="outline" onClick={onStartMeeting} className="h-11 rounded-xl border-white/70 bg-white/68 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/85 active:scale-[0.98]">
            <Mic className="mr-2 h-4 w-4" />
            Iniciar reunião
          </Button>
        </div>
      </div>
    </section>
  );
}
