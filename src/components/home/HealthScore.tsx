import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HealthScoreProps {
  score: number;
  factors: Array<{ label: string; score: number; weight: number }>;
  delay?: number;
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Ótimo";
  if (score >= 60) return "Bom";
  if (score >= 40) return "Atenção";
  return "Crítico";
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function getStrokeColor(score: number) {
  if (score >= 80) return "#34d399";
  if (score >= 60) return "#60a5fa";
  if (score >= 40) return "#fbbf24";
  return "#f87171";
}

export function HealthScore({ score, factors, delay = 0 }: HealthScoreProps) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <GlassCard className="p-5 md:p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white/90 font-semibold text-sm">Saúde Financeira</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-white/30 hover:text-white/60 transition-colors text-xs">ⓘ</button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs">
              Score composto por margem de lucro, fôlego de caixa, contas a receber e tendência mensal. Cada fator vale até 25 pontos.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Gauge */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke={getStrokeColor(score)}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference}
                className="animate-gauge-fill"
                style={{
                  "--gauge-circumference": circumference,
                  "--gauge-offset": offset,
                } as React.CSSProperties}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-3xl font-bold tabular-nums", getScoreColor(score))}>
                {score}
              </span>
              <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                {getScoreLabel(score)}
              </span>
            </div>
          </div>
        </div>

        {/* Factors */}
        <div className="mt-4 space-y-2">
          {factors.map((f, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-white/40 text-[11px]">{f.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${(f.score / f.weight) * 100}%`,
                      background: getStrokeColor((f.score / f.weight) * 100),
                    }}
                  />
                </div>
                <span className="text-white/50 text-[10px] tabular-nums w-8 text-right">
                  {f.score}/{f.weight}
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
