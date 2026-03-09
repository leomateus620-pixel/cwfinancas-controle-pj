import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ForecastMonthly } from "@/hooks/useForecast";
import { formatCurrencyBR, formatCompactBR } from "@/lib/currency";

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

type Series = "receita" | "despesa" | "saldo";

interface Props {
  forecastData: ForecastMonthly[];
}

export function ForecastChart({ forecastData }: Props) {
  const [activeSeries, setActiveSeries] = useState<Series>("receita");

  const realMonths = forecastData.filter((d) => !d.is_forecast);
  const forecastMonths = forecastData.filter((d) => d.is_forecast);
  const lastReal = realMonths.length > 0 ? realMonths[realMonths.length - 1] : null;
  const lastRealMonth = lastReal?.month_key ?? null;

  // Build chart data — bridge last real point into forecast series for visual continuity
  const chartData = forecastData.map((d, idx) => {
    const [year, mon] = d.month_key.split("-");
    const label = `${MONTH_LABELS[mon]} ${year.slice(2)}`;

    const isFirstForecast = d.is_forecast && lastReal && forecastMonths[0]?.month_key === d.month_key;

    const getValues = () => {
      switch (activeSeries) {
        case "receita":
          return {
            real: d.is_forecast ? null : d.receita_real,
            previsto: d.is_forecast ? d.receita_prev_base : (isFirstForecast ? d.receita_prev_base : null),
            otimista: d.is_forecast ? d.receita_prev_opt : null,
            pessimista: d.is_forecast ? d.receita_prev_pess : null,
            // Bridge point: also show forecast value on last real month
            bridge: null as number | null,
          };
        case "despesa":
          return {
            real: d.is_forecast ? null : d.despesa_real,
            previsto: d.is_forecast ? d.despesa_prev_base : null,
            otimista: d.is_forecast ? d.despesa_prev_opt : null,
            pessimista: d.is_forecast ? d.despesa_prev_pess : null,
            bridge: null as number | null,
          };
        case "saldo":
          return {
            real: d.is_forecast ? null : d.saldo_real,
            previsto: d.is_forecast ? d.saldo_prev_base : null,
            otimista: d.is_forecast ? d.saldo_prev_opt : null,
            pessimista: d.is_forecast ? d.saldo_prev_pess : null,
            bridge: null as number | null,
          };
      }
    };

    return { month: label, monthKey: d.month_key, ...getValues() };
  });

  // Bridge: set last real point's "previsto" to its real value so lines connect
  if (lastReal && forecastMonths.length > 0) {
    const lastRealIdx = chartData.findIndex((d) => d.monthKey === lastReal.month_key);
    if (lastRealIdx >= 0) {
      const realVal = activeSeries === "receita" ? lastReal.receita_real
        : activeSeries === "despesa" ? lastReal.despesa_real
        : lastReal.saldo_real;
      chartData[lastRealIdx].previsto = realVal;
    }
  }

  const transitionLabel = lastRealMonth
    ? (() => {
        const [y, m] = lastRealMonth.split("-");
        return `${MONTH_LABELS[m]} ${y.slice(2)}`;
      })()
    : null;

  const seriesLabels: Record<Series, string> = {
    receita: "Receita",
    despesa: "Despesa",
    saldo: "Saldo",
  };

  return (
    <div className="liquid-glass-caixa relative overflow-hidden p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Projeção de {seriesLabels[activeSeries]}
          </h3>
          <p className="text-sm text-muted-foreground">
            Histórico + previsão com intervalos de confiança
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl liquid-glass-bank-card">
          {(["receita", "despesa", "saldo"] as Series[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveSeries(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                activeSeries === s
                  ? "liquid-glass-chip-active text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {seriesLabels[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.1} />
                <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              interval={forecastData.length > 14 ? 2 : 1}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={formatCompactBR}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0]?.payload;
                const real = data?.real;
                const prev = data?.previsto;
                const isTransition = data?.monthKey === lastRealMonth;
                return (
                  <div className="liquid-glass-caixa p-3 text-sm !rounded-xl shadow-lg">
                    <p className="font-semibold text-foreground mb-1">{label}</p>
                    {real != null && (
                      <p className="text-foreground">
                        Real: <span className="font-semibold">{formatCurrencyBR(real)}</span>
                      </p>
                    )}
                    {prev != null && !isTransition && (
                      <>
                        <p className="text-emerald-600">
                          Previsto: <span className="font-semibold">{formatCurrencyBR(prev)}</span>
                        </p>
                        {data?.otimista != null && (
                          <p className="text-muted-foreground text-xs mt-1">
                            Banda: {formatCurrencyBR(data.pessimista)} – {formatCurrencyBR(data.otimista)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              }}
            />
            {transitionLabel && (
              <ReferenceLine
                x={transitionLabel}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{
                  value: "Hoje",
                  position: "top",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 11,
                }}
              />
            )}
            <Area type="monotone" dataKey="otimista" stroke="transparent" fill="url(#bandGrad)" />
            <Area
              type="monotone"
              dataKey="pessimista"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1}
              strokeDasharray="3 3"
              fill="transparent"
            />
            <Area
              type="monotone"
              dataKey="previsto"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              strokeDasharray="6 3"
              fill="url(#forecastGrad)"
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="real"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#realGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-1))]" />
          <span className="text-sm text-muted-foreground">Dados Reais</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success" />
          <span className="text-sm text-muted-foreground">Previsão Base</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
          <span className="text-sm text-muted-foreground">Banda de Confiança</span>
        </div>
      </div>
    </div>
  );
}
