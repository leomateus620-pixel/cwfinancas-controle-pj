import { useState, useMemo } from "react";
import { GlassCard } from "./GlassCard";
import { LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

interface DailySummaryProps {
  dailyTrend: Array<{ date: string; value: number }>;
  insights: string[];
  delay?: number;
}

export function DailySummary({ dailyTrend, insights, delay = 0 }: DailySummaryProps) {
  const [period, setPeriod] = useState<7 | 14 | 30>(30);

  const filteredData = useMemo(() => {
    return dailyTrend.slice(-period);
  }, [dailyTrend, period]);

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <GlassCard className="p-5 md:p-6 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white/90 font-semibold text-sm">Resumo do Dia</h3>
          <div className="flex gap-1">
            {([7, 14, 30] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  period === p
                    ? "bg-white/15 text-white"
                    : "text-white/30 hover:text-white/50 hover:bg-white/5"
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>

        {/* Sparkline */}
        <div className="h-20 mb-5">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData}>
              <defs>
                <linearGradient id="sparklineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={1} />
                </linearGradient>
              </defs>
              <Line
                type="monotone"
                dataKey="value"
                stroke="url(#sparklineGrad)"
                strokeWidth={2}
                dot={false}
                animationDuration={1500}
              />
              <RechartsTooltip
                contentStyle={{
                  background: "rgba(0,0,0,0.8)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  fontSize: "11px",
                  color: "#fff",
                }}
                formatter={(v: number) => [
                  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                  "Saldo"
                ]}
                labelFormatter={(l: string) => {
                  const d = new Date(l + "T00:00:00");
                  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Insights bullets */}
        <div className="space-y-2.5">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 mt-1.5 shrink-0" />
              <p className="text-white/60 text-xs leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
