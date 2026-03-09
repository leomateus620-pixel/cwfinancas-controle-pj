import { TrendingUp, TrendingDown, Target, Shield, Wallet } from "lucide-react";
import type { ForecastMonthly } from "@/hooks/useForecast";
import { formatCurrencyBR } from "@/lib/currency";

interface Props {
  realMonths: ForecastMonthly[];
  forecastMonths: ForecastMonthly[];
  confidence: number;
}

export function ForecastKPIs({ realMonths, forecastMonths, confidence }: Props) {
  const nextQ = forecastMonths.slice(0, 3);
  const receitaQ = nextQ.reduce((s, d) => s + (d.receita_prev_base || 0), 0);

  const totalRec = nextQ.reduce((s, d) => s + (d.receita_prev_base || 0), 0);
  const totalDesp = nextQ.reduce((s, d) => s + (d.despesa_prev_base || 0), 0);
  const margemProj = totalRec > 0 ? ((totalRec - totalDesp) / totalRec) * 100 : 0;

  const recent = realMonths.slice(-3);
  const older = realMonths.slice(-6, -3);
  const recentAvg = recent.length > 0 ? recent.reduce((s, d) => s + d.receita_real, 0) / recent.length : 0;
  const olderAvg = older.length > 0 ? older.reduce((s, d) => s + d.receita_real, 0) / older.length : 0;
  const trendPct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
  const hasTrend = older.length > 0;

  // Accumulated projected balance (sum of all forecast saldos)
  const saldoAcumulado = forecastMonths.reduce((s, d) => s + (d.saldo_prev_base || 0), 0);
  // Last real saldo for context
  const lastRealSaldo = realMonths.length > 0 ? realMonths[realMonths.length - 1].saldo_real : 0;

  const kpis = [
    {
      title: "Receita Prevista (Trim.)",
      value: formatCurrencyBR(receitaQ),
      change: hasTrend ? trendPct : null,
      changeLabel: hasTrend ? "tendência recente" : `média mensal ${formatCurrencyBR(receitaQ / Math.max(nextQ.length, 1))}`,
      icon: <TrendingUp className="w-5 h-5" />,
      accentColor: "border-l-emerald-500",
      iconBg: "bg-emerald-500/10 text-emerald-600",
    },
    {
      title: "Margem Projetada",
      value: `${margemProj.toFixed(1)}%`,
      change: margemProj > 20 ? margemProj - 20 : -(20 - margemProj),
      changeLabel: "vs meta 20%",
      icon: <Target className="w-5 h-5" />,
      accentColor: "border-l-primary",
      iconBg: "bg-primary/10 text-primary",
    },
    {
      title: "Confiança da Previsão",
      value: `${Math.round(confidence)}%`,
      change: null,
      changeLabel: confidence >= 70 ? "alta confiabilidade" : "dados limitados",
      icon: <Shield className="w-5 h-5" />,
      accentColor: "border-l-sky-500",
      iconBg: "bg-sky-500/10 text-sky-600",
    },
    {
      title: "Saldo Projetado Acum.",
      value: formatCurrencyBR(saldoAcumulado),
      change: saldoAcumulado > 0 ? null : null,
      changeLabel: saldoAcumulado >= 0 ? "resultado positivo" : "atenção: resultado negativo",
      icon: <Wallet className="w-5 h-5" />,
      accentColor: saldoAcumulado >= 0 ? "border-l-emerald-500" : "border-l-red-500",
      iconBg: saldoAcumulado >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => (
        <div
          key={i}
          className={`liquid-glass-caixa p-5 border-l-[3px] ${kpi.accentColor} transition-all duration-300 ease-out hover:scale-[1.01]`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {kpi.title}
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
              {kpi.icon}
            </div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight">
            {kpi.value}
          </p>
          <div className="flex items-center gap-1 mt-2">
            {kpi.change != null && kpi.change !== 0 && (
              <span
                className={`text-xs font-medium ${kpi.change > 0 ? "text-emerald-600" : "text-red-500"}`}
              >
                {kpi.change > 0 ? "+" : ""}
                {kpi.change.toFixed(1)}%
              </span>
            )}
            <span className="text-xs text-muted-foreground">{kpi.changeLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
