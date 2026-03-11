import { useState, useMemo } from "react";
import { GlassCard } from "./GlassCard";
import { AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatCurrencyBR, formatCompactBR } from "@/lib/currency";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface CashPositionPoint {
  month: string;   // "2025-01"
  label: string;    // "Jan/25"
  value: number;
}

interface CashEvolutionChartProps {
  data: CashPositionPoint[];
  insights: string[];
  delay?: number;
}

type PeriodFilter = 6 | 12 | 999;

export function CashEvolutionChart({ data, insights, delay = 0 }: CashEvolutionChartProps) {
  const [period, setPeriod] = useState<PeriodFilter>(12);

  const filteredData = useMemo(() => {
    if (period === 999) return data;
    return data.slice(-period);
  }, [data, period]);

  const trend = useMemo(() => {
    if (filteredData.length < 2) return { direction: "stable" as const, percent: 0 };
    const last = filteredData[filteredData.length - 1].value;
    const prev = filteredData[filteredData.length - 2].value;
    if (prev === 0) return { direction: "stable" as const, percent: 0 };
    const pct = ((last - prev) / Math.abs(prev)) * 100;
    return {
      direction: pct > 1 ? "up" as const : pct < -1 ? "down" as const : "stable" as const,
      percent: Math.abs(Math.round(pct * 10) / 10),
    };
  }, [filteredData]);

  const lastValue = filteredData.length > 0 ? filteredData[filteredData.length - 1].value : 0;

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <GlassCard className="p-5 md:p-6 h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-foreground font-semibold text-sm tracking-tight">
              Evolução do Caixa
            </h3>
            <p className="text-muted-foreground/60 text-[11px] mt-0.5">
              Posição acumulada no dia 5 de cada mês
            </p>
          </div>
          <div className="flex gap-1">
            {([
              { value: 6 as PeriodFilter, label: "6m" },
              { value: 12 as PeriodFilter, label: "12m" },
              { value: 999 as PeriodFilter, label: "Tudo" },
            ]).map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  period === p.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-foreground/5"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Current value + trend badge */}
        <div className="flex items-end gap-3 mb-4">
          <span className="text-foreground text-xl font-bold tracking-tight">
            {formatCurrencyBR(lastValue)}
          </span>
          {trend.direction !== "stable" && (
            <span className={`flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${
              trend.direction === "up"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-red-500/10 text-red-600"
            }`}>
              {trend.direction === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.percent}%
            </span>
          )}
          {trend.direction === "stable" && (
            <span className="flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground">
              <Minus className="w-3 h-3" /> Estável
            </span>
          )}
        </div>

        {/* Area Chart */}
        <div className="h-[140px] mb-4 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(221 85% 53%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(221 85% 53%)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="cashLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(221 85% 53%)" stopOpacity={0.6} />
                  <stop offset="50%" stopColor="hsl(221 85% 53%)" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatCompactBR(v)}
                width={52}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="url(#cashLineGrad)"
                strokeWidth={2.5}
                fill="url(#cashAreaGrad)"
                dot={{ r: 3.5, fill: "hsl(221 85% 53%)", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: "hsl(221 85% 53%)", stroke: "#fff", strokeWidth: 2 }}
                animationDuration={1200}
              />
              <RechartsTooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "hsl(var(--foreground))",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  padding: "8px 12px",
                }}
                formatter={(v: number) => [formatCurrencyBR(v), "Posição"]}
                labelFormatter={(label: string) => `Dia 5 — ${label}`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Insights */}
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
              <p className="text-muted-foreground text-xs leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
