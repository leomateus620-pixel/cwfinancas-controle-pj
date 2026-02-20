import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";

interface ProfitQualityProps {
  value: number | null;
  prevValue: number | null;
  delay?: number;
}

function getQualityLabel(value: number) {
  if (value > 100) return "Excelente";
  if (value >= 70) return "Normal";
  return "Alerta";
}

function getQualityColor(value: number) {
  if (value > 100) return "text-emerald-600";
  if (value >= 70) return "text-blue-600";
  return "text-amber-600";
}

function getStrokeColor(value: number) {
  if (value > 100) return "#059669";
  if (value >= 70) return "#2563eb";
  return "#d97706";
}

export function ProfitQuality({ value, prevValue, delay = 0 }: ProfitQualityProps) {
  const hasData = value !== null;
  const displayValue = hasData ? Math.round(value) : null;
  const circumference = 2 * Math.PI * 45;
  const clampedPercent = hasData ? Math.min(Math.max(value, 0), 150) / 150 : 0;
  const offset = circumference - clampedPercent * circumference;

  // Variation vs previous
  let variationPct: number | null = null;
  if (value !== null && prevValue !== null && prevValue !== 0) {
    variationPct = Math.round(((value - prevValue) / Math.abs(prevValue)) * 100);
  }

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <GlassCard className="p-5 md:p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-foreground/90 font-semibold text-sm">Qualidade do Lucro</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors text-xs">ⓘ</button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[300px] text-xs">
              <p className="font-medium mb-1">Conversão de lucro em caixa</p>
              <p>Fórmula: (Fluxo de Caixa Operacional ÷ Lucro Líquido DRE) × 100</p>
              <p className="mt-1 text-muted-foreground">&gt;100% Excelente · 70-100% Normal · &lt;70% Alerta</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {!hasData ? (
          <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
            <Info className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground/60 text-xs leading-relaxed">
              Importe a aba DRE na planilha para calcular a qualidade do lucro.
            </p>
          </div>
        ) : (
          <>
            {/* Gauge */}
            <div className="flex-1 flex items-center justify-center">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke={getStrokeColor(value)}
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
                  <span className={cn("text-2xl font-bold tabular-nums", getQualityColor(value))}>
                    {displayValue}%
                  </span>
                </div>
              </div>
            </div>

            {/* Label + subtitle */}
            <div className="text-center mt-2">
              <span className={cn("text-xs font-semibold", getQualityColor(value))}>
                {getQualityLabel(value)}
              </span>
              <p className="text-muted-foreground/60 text-[10px] mt-0.5">Conversão de lucro em caixa</p>
            </div>

            {/* Variation badge */}
            {variationPct !== null && (
              <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-foreground/5">
                {variationPct > 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                ) : variationPct < 0 ? (
                  <TrendingDown className="w-3 h-3 text-red-600" />
                ) : (
                  <Minus className="w-3 h-3 text-muted-foreground" />
                )}
                <span className={cn(
                  "text-[11px] font-medium tabular-nums",
                  variationPct > 0 ? "text-emerald-600" : variationPct < 0 ? "text-red-600" : "text-muted-foreground"
                )}>
                  {variationPct > 0 ? "+" : ""}{variationPct}% vs mês anterior
                </span>
              </div>
            )}
          </>
        )}
      </GlassCard>
    </div>
  );
}
