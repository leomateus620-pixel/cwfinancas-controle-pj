import { useState, useMemo } from "react";
import { GlassCard } from "./GlassCard";
import {
  LineChart, Line, Area, AreaChart, ComposedChart,
  ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { formatCurrencyBR, formatCompactBR } from "@/lib/currency";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CashPositionPeriod } from "@/hooks/useCashPosition";
import { useIsMobile } from "@/hooks/use-mobile";

interface CashEvolutionChartProps {
  data: CashPositionPeriod[];
  accountNames: string[];
  insights: string[];
  delay?: number;
  isEmpty?: boolean;
}

type PeriodFilter = 6 | 12 | 999;

const ACCOUNT_COLORS: Array<{ stroke: string; fill: string; label: string }> = [
  { stroke: "hsl(221, 85%, 53%)", fill: "hsl(221, 85%, 53%)", label: "Conta 1" },
  { stroke: "hsl(160, 84%, 39%)", fill: "hsl(160, 84%, 39%)", label: "Conta 2" },
];

function CustomTooltip({ active, payload, label, accountNames, data }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const currentPoint = data?.find((d: any) => d.label === label);
  const currentIdx = data?.indexOf(currentPoint);
  const prevPoint = currentIdx > 0 ? data[currentIdx - 1] : null;

  const total = currentPoint?.totalBalance ?? 0;
  const prevTotal = prevPoint?.totalBalance ?? null;
  const variation = prevTotal !== null && prevTotal !== 0
    ? ((total - prevTotal) / Math.abs(prevTotal)) * 100
    : null;

  return (
    <div className="rounded-xl border border-white/[0.12] bg-card/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.16)] p-4 min-w-[200px]">
      <p className="text-xs font-semibold text-foreground mb-3">{label}</p>

      {accountNames.map((name: string, i: number) => {
        const val = currentPoint?.accounts?.[name];
        if (val === null || val === undefined) return null;
        const color = ACCOUNT_COLORS[i] || ACCOUNT_COLORS[0];
        return (
          <div key={name} className="flex items-center justify-between gap-4 mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.stroke }} />
              <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{name}</span>
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-foreground">
              {formatCurrencyBR(val)}
            </span>
          </div>
        );
      })}

      <div className="border-t border-foreground/[0.06] mt-2 pt-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-foreground/70">Total</span>
        <span className="text-[12px] font-bold tabular-nums text-foreground">
          {formatCurrencyBR(total)}
        </span>
      </div>

      {variation !== null && (
        <div className="mt-1.5 flex items-center justify-end gap-1">
          {variation >= 0
            ? <TrendingUp className="w-3 h-3 text-[hsl(160,84%,39%)]" />
            : <TrendingDown className="w-3 h-3 text-[hsl(0,72%,51%)]" />
          }
          <span className={`text-[10px] font-semibold tabular-nums ${variation >= 0 ? "text-[hsl(160,84%,30%)]" : "text-[hsl(0,60%,48%)]"}`}>
            {variation >= 0 ? "+" : ""}{variation.toFixed(1)}% vs anterior
          </span>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
        <BarChart3 className="w-5 h-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-foreground/60 mb-1">Sem dados de saldos bancários</p>
      <p className="text-xs text-muted-foreground/50 max-w-[240px]">
        Importe sua planilha com saldos por banco para visualizar a evolução do caixa.
      </p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[140px] w-full rounded-xl" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

export function CashEvolutionChart({ data, accountNames, insights, delay = 0, isEmpty = false }: CashEvolutionChartProps) {
  const [period, setPeriod] = useState<PeriodFilter>(12);
  const isMobile = useIsMobile();

  const filteredData = useMemo(() => {
    if (period === 999) return data;
    return data.slice(-period);
  }, [data, period]);

  // Build chart data with flattened account keys
  const chartData = useMemo(() => {
    return filteredData.map(p => ({
      ...p,
      ...p.accounts,
    }));
  }, [filteredData]);

  const trend = useMemo(() => {
    if (filteredData.length < 2) return { direction: "stable" as const, percent: 0 };
    const last = filteredData[filteredData.length - 1].totalBalance;
    const prev = filteredData[filteredData.length - 2].totalBalance;
    if (prev === 0) return { direction: "stable" as const, percent: 0 };
    const pct = ((last - prev) / Math.abs(prev)) * 100;
    return {
      direction: pct > 1 ? "up" as const : pct < -1 ? "down" as const : "stable" as const,
      percent: Math.abs(Math.round(pct * 10) / 10),
    };
  }, [filteredData]);

  const lastValue = filteredData.length > 0 ? filteredData[filteredData.length - 1].totalBalance : 0;
  const chartHeight = isMobile ? 120 : 160;
  const xInterval = isMobile ? Math.max(1, Math.floor(filteredData.length / 4)) : "preserveStartEnd";

  // Loading state
  if (data.length === 0 && !isEmpty) {
    return (
      <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}>
        <GlassCard className="p-5 md:p-6 h-full">
          <ChartSkeleton />
        </GlassCard>
      </div>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}>
        <GlassCard className="p-5 md:p-6 h-full">
          <EmptyState />
        </GlassCard>
      </div>
    );
  }

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
              Saldo consolidado por competência
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
                ? "bg-[hsl(160,84%,39%)]/10 text-[hsl(160,84%,30%)]"
                : "bg-[hsl(0,72%,51%)]/10 text-[hsl(0,60%,48%)]"
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

        {/* Chart */}
        <div style={{ height: chartHeight }} className="mb-4 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {accountNames.map((_, i) => {
                  const color = ACCOUNT_COLORS[i] || ACCOUNT_COLORS[0];
                  return (
                    <linearGradient key={`grad-${i}`} id={`cashAcctGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color.fill} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={color.fill} stopOpacity={0.02} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval={xInterval as any}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatCompactBR(v)}
                width={52}
              />
              {accountNames.map((name, i) => {
                const color = ACCOUNT_COLORS[i] || ACCOUNT_COLORS[0];
                const isFirst = i === 0;
                return (
                  <Area
                    key={`area-${name}`}
                    type="monotone"
                    dataKey={name}
                    stroke={color.stroke}
                    strokeWidth={isFirst ? 2.5 : 2}
                    fill={`url(#cashAcctGrad${i})`}
                    dot={{ r: 3, fill: color.stroke, stroke: "#fff", strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: color.stroke, stroke: "#fff", strokeWidth: 2 }}
                    connectNulls={false}
                    animationDuration={1200}
                    strokeOpacity={isFirst ? 1 : 0.8}
                  />
                );
              })}
              <RechartsTooltip
                content={<CustomTooltip accountNames={accountNames} data={filteredData} />}
                cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "4 4" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        {accountNames.length > 1 && (
          <div className="flex flex-wrap gap-4 mb-3">
            {accountNames.map((name, i) => {
              const color = ACCOUNT_COLORS[i] || ACCOUNT_COLORS[0];
              return (
                <div key={name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.stroke }} />
                  <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[140px]">{name}</span>
                </div>
              );
            })}
          </div>
        )}

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
