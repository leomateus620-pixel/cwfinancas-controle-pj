import { TrendingUp, TrendingDown, Target, AlertCircle, Shield } from "lucide-react";
import type { ForecastMonthly } from "@/hooks/useForecast";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

interface Props {
  realMonths: ForecastMonthly[];
  forecastMonths: ForecastMonthly[];
  confidence: number;
}

export function ForecastKPIs({ realMonths, forecastMonths, confidence }: Props) {
  // Receita prevista próximo trimestre
  const nextQ = forecastMonths.slice(0, 3);
  const receitaQ = nextQ.reduce((s, d) => s + (d.receita_prev_base || 0), 0);

  // Margem projetada
  const totalRec = nextQ.reduce((s, d) => s + (d.receita_prev_base || 0), 0);
  const totalDesp = nextQ.reduce((s, d) => s + (d.despesa_prev_base || 0), 0);
  const margemProj = totalRec > 0 ? ((totalRec - totalDesp) / totalRec) * 100 : 0;

  // Trend: compare last 3 real months avg vs previous 3
  const recent = realMonths.slice(-3);
  const older = realMonths.slice(-6, -3);
  const recentAvg = recent.length > 0 ? recent.reduce((s, d) => s + d.receita_real, 0) / recent.length : 0;
  const olderAvg = older.length > 0 ? older.reduce((s, d) => s + d.receita_real, 0) / older.length : 0;
  const trendPct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  // Risk: despesa growth
  const recentDesp = recent.length > 0 ? recent.reduce((s, d) => s + d.despesa_real, 0) / recent.length : 0;
  const olderDesp = older.length > 0 ? older.reduce((s, d) => s + d.despesa_real, 0) / older.length : 0;
  const despTrend = olderDesp > 0 ? ((recentDesp - olderDesp) / olderDesp) * 100 : 0;

  const kpis = [
    {
      title: "Receita Prevista (Trimestre)",
      value: formatCurrency(receitaQ),
      change: trendPct,
      changeLabel: "tendência recente",
      icon: <TrendingUp className="w-5 h-5 text-success" />,
    },
    {
      title: "Margem Projetada",
      value: `${margemProj.toFixed(1)}%`,
      change: margemProj > 20 ? margemProj - 20 : -(20 - margemProj),
      changeLabel: "vs meta 20%",
      icon: <Target className="w-5 h-5 text-primary" />,
    },
    {
      title: "Confiança da Previsão",
      value: `${Math.round(confidence)}%`,
      change: 0,
      changeLabel: confidence >= 70 ? "alta confiabilidade" : "dados limitados",
      icon: <Shield className="w-5 h-5 text-info" />,
    },
    {
      title: "Tendência de Despesas",
      value: `${despTrend > 0 ? "+" : ""}${despTrend.toFixed(1)}%`,
      change: -despTrend,
      changeLabel: "últimos 3 meses",
      icon: despTrend > 5
        ? <AlertCircle className="w-5 h-5 text-warning" />
        : <TrendingDown className="w-5 h-5 text-success" />,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {kpis.map((kpi, i) => (
        <div key={i} className="liquid-glass-navy p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">{kpi.title}</span>
            {kpi.icon}
          </div>
          <p className="text-2xl font-bold text-[#0a1940] tabular-nums">
            {kpi.value}
          </p>
          <div className="flex items-center gap-1 mt-2">
            {kpi.change !== 0 && (
              <span
                className={`text-xs font-medium ${kpi.change > 0 ? "text-success" : "text-destructive"}`}
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
