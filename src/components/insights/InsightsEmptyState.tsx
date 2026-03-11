import { Sparkles, RefreshCw, ShieldAlert, TrendingUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InsightsEmptyStateProps {
  isGenerating: boolean;
  onGenerate: () => void;
  hasInsufficientData?: boolean;
}

export function InsightsEmptyState({ isGenerating, onGenerate, hasInsufficientData }: InsightsEmptyStateProps) {
  if (hasInsufficientData) {
    return (
      <div className="liquid-glass-card p-10 md:p-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 animate-float">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Dados insuficientes
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
          Não há transações suficientes para gerar uma análise confiável neste período. Importe mais dados ou amplie o intervalo de datas.
        </p>
        <Button onClick={onGenerate} disabled={isGenerating} size="lg" className="gap-2 rounded-full px-8">
          {isGenerating ? (
            <><RefreshCw className="w-4 h-4 animate-spin" />Analisando…</>
          ) : (
            <><Sparkles className="w-4 h-4" />Tentar mesmo assim</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-8 md:py-16 animate-page-slide">
      {/* Hero Card */}
      <div className="relative w-full max-w-lg mx-auto mb-10">
        {/* Gradient border glow */}
        <div className="absolute -inset-[2px] rounded-3xl bg-gradient-to-br from-orange-500 via-purple-500 to-blue-500 opacity-60 blur-sm" />
        <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-orange-500 via-purple-500 to-blue-500 opacity-80" />

        {/* Dark card */}
        <div className="relative rounded-3xl bg-slate-900/95 backdrop-blur-xl p-6 md:p-8 overflow-hidden">
          {/* Subtle inner gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 via-transparent to-purple-900/20 rounded-3xl" />

          {/* Mock chart area */}
          <div className="relative mb-4">
            {/* Orange progress bar at top */}
            <div className="h-1.5 w-full rounded-full bg-slate-700/60 mb-6 overflow-hidden">
              <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-orange-400 to-orange-500 animate-pulse" />
            </div>

            {/* Mock bar chart */}
            <div className="flex items-end gap-2 h-32 px-2">
              {[40, 65, 50, 80, 55, 70, 45, 90, 60, 75, 48, 85].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm transition-all duration-700"
                  style={{
                    height: `${h}%`,
                    background: i >= 9
                      ? "linear-gradient(to top, hsl(var(--primary) / 0.9), hsl(var(--primary) / 0.5))"
                      : `linear-gradient(to top, hsl(220 15% ${28 + i * 2}%), hsl(220 15% ${38 + i * 2}%))`,
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              ))}
            </div>

            {/* Mock axis line */}
            <div className="h-px bg-slate-700/60 mt-1" />
          </div>

          {/* AI Badge */}
          <div className="relative flex items-center gap-3 mt-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-primary text-white text-xs font-bold shadow-lg shadow-primary/30">
              <Sparkles className="w-3 h-3" />
              AI
            </div>
            {/* Animated dots */}
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-500"
                  style={{
                    animation: "pulse 1.4s ease-in-out infinite",
                    animationDelay: `${i * 200}ms`,
                  }}
                />
              ))}
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Pronto para analisar</span>
          </div>
        </div>
      </div>

      {/* Title & description */}
      <div className="text-center max-w-xl mx-auto mb-8 px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 tracking-tight">
          Análise financeira inteligente com IA
        </h2>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
          Identifique padrões, riscos e oportunidades nos seus dados financeiros.
          Receitas, despesas, tendências e anomalias — tudo analisado automaticamente.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3 mb-10 px-4">
        {[
          { icon: ShieldAlert, label: "Riscos", color: "text-red-400 bg-red-500/10 border-red-500/20" },
          { icon: TrendingUp, label: "Oportunidades", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
          { icon: Search, label: "Anomalias", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-medium ${color}`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </div>
        ))}
      </div>

      {/* CTA */}
      <Button
        onClick={onGenerate}
        disabled={isGenerating}
        size="lg"
        className="gap-2 rounded-full px-10 py-6 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
      >
        {isGenerating ? (
          <><RefreshCw className="w-5 h-5 animate-spin" />Analisando seus dados…</>
        ) : (
          <><Sparkles className="w-5 h-5" />Gerar Insights</>
        )}
      </Button>
    </div>
  );
}
