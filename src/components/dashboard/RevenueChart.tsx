import { useMemo } from "react";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend
} from "recharts";
import { TrendBadge } from "@/components/ui/trend-badge";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { formatCurrencyBR, formatCompactBR } from "@/lib/currency";
import { Transaction } from "@/hooks/useTransactions";

interface RevenueChartProps {
  transactions?: Transaction[];
  isLoading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: string;
}

const dataKeyLabels: Record<string, string> = {
  receita: "Receita",
  despesas: "Despesas",
};

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="liquid-glass-tooltip">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground text-xs">{dataKeyLabels[entry.dataKey] || entry.dataKey}:</span>
              <span className="font-semibold text-sm text-foreground">
                {formatCurrencyBR(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const renderLegend = () => {
  return (
    <div className="flex items-center justify-center gap-5 mt-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-chart-1" />
        <span className="text-xs text-muted-foreground font-medium">Receita</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-chart-5" />
        <span className="text-xs text-muted-foreground font-medium">Despesas</span>
      </div>
    </div>
  );
};

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function RevenueChart({ transactions: txProp, isLoading: loadingProp }: RevenueChartProps) {
  // Use provided transactions or empty array
  const transactions = txProp ?? [];
  const isLoading = loadingProp ?? false;

  const revenueData = useMemo(() => {
    if (!transactions.length) return [];

    const monthlyData: Record<string, { receita: number; despesas: number }> = {};
    
    transactions.forEach((t) => {
      const monthKey = t.date.substring(0, 7);
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { receita: 0, despesas: 0 };
      }
      
      if (t.type === "income") {
        monthlyData[monthKey].receita += Number(t.amount);
      } else {
        monthlyData[monthKey].despesas += Number(t.amount);
      }
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => {
        const [year, monthStr] = key.split('-');
        const monthIdx = parseInt(monthStr, 10) - 1;
        return {
          month: `${monthNames[monthIdx] || monthStr}/${year.slice(2)}`,
          receita: values.receita,
          despesas: values.despesas,
        };
      })
      .slice(-12);
  }, [transactions]);

  const trend = useMemo(() => {
    if (revenueData.length < 2) return 0;
    const lastMonth = revenueData[revenueData.length - 1]?.receita || 0;
    const previousMonth = revenueData[revenueData.length - 2]?.receita || 0;
    if (previousMonth === 0) return 0;
    return ((lastMonth - previousMonth) / previousMonth) * 100;
  }, [revenueData]);

  if (isLoading) {
    return (
      <div className="liquid-glass-card p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Tendência de Receita</h3>
        <ChartSkeleton type="area" height="h-[280px]" />
      </div>
    );
  }

  return (
    <div className="liquid-glass-card p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">Tendência de Receita</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Receita vs despesas ao longo do tempo</p>
        </div>
        {revenueData.length > 0 && <TrendBadge value={trend} size="sm" />}
      </div>
      {revenueData.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
          <p>Sem dados de receita disponíveis</p>
        </div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={revenueData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25}/>
                  <stop offset="50%" stopColor="hsl(var(--chart-1))" stopOpacity={0.08}/>
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-5))" stopOpacity={0.15}/>
                  <stop offset="100%" stopColor="hsl(var(--chart-5))" stopOpacity={0}/>
                </linearGradient>
                <filter id="glow-revenue">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid 
                strokeDasharray="4 4" 
                stroke="hsl(var(--border))" 
                vertical={false}
                strokeOpacity={0.35}
              />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                dy={8}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={formatCompactBR}
                dx={-8}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2.5}
                fill="url(#revenueGradient)"
                filter="url(#glow-revenue)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "hsl(var(--chart-1))",
                  stroke: "white",
                  strokeWidth: 2.5,
                  style: { filter: 'drop-shadow(0 2px 4px rgba(45,126,243,0.3))' },
                }}
                animationDuration={1200}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="despesas"
                stroke="hsl(var(--chart-5))"
                strokeWidth={1.5}
                fill="url(#expensesGradient)"
                strokeDasharray="6 3"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "hsl(var(--chart-5))",
                  stroke: "white",
                  strokeWidth: 2,
                }}
                animationBegin={150}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
