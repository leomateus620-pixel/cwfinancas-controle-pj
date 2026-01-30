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
import { Loader2 } from "lucide-react";
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
      <div className="glass-premium rounded-xl p-4 shadow-premium-lg border border-border/50 animate-slide-up-fade">
        <p className="text-sm font-semibold text-foreground mb-3">{label}</p>
        <div className="space-y-2">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full shadow-sm" 
                style={{ 
                  backgroundColor: entry.color,
                  boxShadow: `0 0 8px ${entry.color}40`
                }}
              />
              <span className="text-muted-foreground text-sm">{dataKeyLabels[entry.dataKey] || entry.dataKey}:</span>
              <span className="font-bold text-foreground">
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
    <div className="flex items-center justify-center gap-6 mt-4">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-chart-1 shadow-sm" style={{ boxShadow: '0 0 8px hsl(var(--chart-1) / 0.4)' }} />
        <span className="text-sm text-muted-foreground font-medium">Receita</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-chart-5" style={{ boxShadow: '0 0 8px hsl(var(--chart-5) / 0.4)' }} />
        <span className="text-sm text-muted-foreground font-medium">Despesas</span>
      </div>
    </div>
  );
};

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function RevenueChart() {
  const { transactions, isLoading } = useTransactions();

  // Agrupar transações por mês
  const revenueData = useMemo(() => {
    if (!transactions.length) return [];

    const monthlyData: Record<string, { receita: number; despesas: number }> = {};
    
    transactions.forEach((t) => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { receita: 0, despesas: 0 };
      }
      
      if (t.type === "income") {
        monthlyData[monthKey].receita += Number(t.amount);
      } else {
        monthlyData[monthKey].despesas += Number(t.amount);
      }
    });

    // Ordenar por data e formatar
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => {
        const [year, month] = key.split('-');
        return {
          month: `${monthNames[parseInt(month)]}/${year.slice(2)}`,
          receita: values.receita,
          despesas: values.despesas,
        };
      })
      .slice(-12); // Últimos 12 meses
  }, [transactions]);

  // Calcular tendência
  const trend = useMemo(() => {
    if (revenueData.length < 2) return 0;
    const lastMonth = revenueData[revenueData.length - 1]?.receita || 0;
    const previousMonth = revenueData[revenueData.length - 2]?.receita || 0;
    if (previousMonth === 0) return 0;
    return ((lastMonth - previousMonth) / previousMonth) * 100;
  }, [revenueData]);

  if (isLoading) {
    return (
      <Card className="glass-premium border-border/50 shadow-premium-md rounded-2xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Tendência de Receita</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton type="area" height="h-[300px] md:h-[350px]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-premium border-border/50 shadow-premium-md hover:shadow-premium-lg transition-premium animate-corporate-enter rounded-2xl overflow-hidden">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 gradient-mesh opacity-50 pointer-events-none" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Tendência de Receita</CardTitle>
            <CardDescription className="text-muted-foreground">Receita mensal vs despesas ao longo do tempo</CardDescription>
          </div>
          {revenueData.length > 0 && <TrendBadge value={trend} size="sm" />}
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {revenueData.length === 0 ? (
          <div className="h-[300px] md:h-[350px] flex items-center justify-center text-muted-foreground">
            <p>Sem dados de receita disponíveis</p>
          </div>
        ) : (
          <div className="h-[300px] md:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={revenueData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  {/* Revenue gradient - More vibrant */}
                  <linearGradient id="revenueGradientPremium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4}/>
                    <stop offset="50%" stopColor="hsl(var(--chart-1))" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                  {/* Expenses gradient */}
                  <linearGradient id="expensesGradientPremium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-5))" stopOpacity={0.25}/>
                    <stop offset="50%" stopColor="hsl(var(--chart-5))" stopOpacity={0.08}/>
                    <stop offset="100%" stopColor="hsl(var(--chart-5))" stopOpacity={0}/>
                  </linearGradient>
                  {/* Line glow filter */}
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
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
                  strokeOpacity={0.5}
                />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 500 }}
                  tickFormatter={formatCurrency}
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={renderLegend} />
                <Area
                  type="monotone"
                  dataKey="receita"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={3}
                  fill="url(#revenueGradientPremium)"
                  filter="url(#glow)"
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: "hsl(var(--chart-1))",
                    stroke: "hsl(var(--background))",
                    strokeWidth: 3,
                    style: { filter: "drop-shadow(0 0 6px hsl(var(--chart-1)))" }
                  }}
                  isAnimationActive={true}
                  animationBegin={0}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="despesas"
                  stroke="hsl(var(--chart-5))"
                  strokeWidth={2}
                  fill="url(#expensesGradientPremium)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: "hsl(var(--chart-5))",
                    stroke: "hsl(var(--background))",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={true}
                  animationBegin={200}
                  animationDuration={1500}
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
