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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendBadge } from "@/components/ui/trend-badge";
import { useTransactions } from "@/hooks/useTransactions";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

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
      <div className="bg-card border border-border rounded-lg p-3 shadow-corporate-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground text-xs">{dataKeyLabels[entry.dataKey] || entry.dataKey}:</span>
              <span className="font-semibold text-sm text-foreground">
                {formatCurrency(entry.value)}
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
        <div className="w-2.5 h-2.5 rounded-full bg-chart-1" />
        <span className="text-xs text-muted-foreground">Receita</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-chart-5" />
        <span className="text-xs text-muted-foreground">Despesas</span>
      </div>
    </div>
  );
};

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function RevenueChart() {
  const { transactions, isLoading } = useTransactions();

  const revenueData = useMemo(() => {
    if (!transactions.length) return [];

    const monthlyData: Record<string, { receita: number; despesas: number }> = {};
    
    transactions.forEach((t) => {
      // Use substring to get YYYY-MM directly from date string (avoids timezone/0-indexed bugs)
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
        const monthIdx = parseInt(monthStr, 10) - 1; // YYYY-MM is 1-indexed
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
      <Card className="border-border shadow-corporate-sm rounded-xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Tendência de Receita</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton type="area" height="h-[280px]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-corporate-sm hover:shadow-corporate-md transition-corporate rounded-xl overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">Tendência de Receita</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Receita vs despesas ao longo do tempo</CardDescription>
          </div>
          {revenueData.length > 0 && <TrendBadge value={trend} size="sm" />}
        </div>
      </CardHeader>
      <CardContent>
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
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-5))" stopOpacity={0.2}/>
                    <stop offset="100%" stopColor="hsl(var(--chart-5))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="4 4" 
                  stroke="hsl(var(--border))" 
                  vertical={false}
                  strokeOpacity={0.5}
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
                  tickFormatter={formatCurrency}
                  dx={-8}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={renderLegend} />
                <Area
                  type="monotone"
                  dataKey="receita"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: "hsl(var(--chart-1))",
                    stroke: "hsl(var(--background))",
                    strokeWidth: 2,
                  }}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="despesas"
                  stroke="hsl(var(--chart-5))"
                  strokeWidth={2}
                  fill="url(#expensesGradient)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "hsl(var(--chart-5))",
                    stroke: "hsl(var(--background))",
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
      </CardContent>
    </Card>
  );
}
