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

// Dados de exemplo - serão substituídos por dados reais
const revenueData = [
  { month: "Jan", receita: 186000, despesas: 142000 },
  { month: "Fev", receita: 205000, despesas: 148000 },
  { month: "Mar", receita: 237000, despesas: 156000 },
  { month: "Abr", receita: 273000, despesas: 165000 },
  { month: "Mai", receita: 209000, despesas: 158000 },
  { month: "Jun", receita: 314000, despesas: 172000 },
  { month: "Jul", receita: 298000, despesas: 168000 },
  { month: "Ago", receita: 342000, despesas: 185000 },
  { month: "Set", receita: 378000, despesas: 192000 },
  { month: "Out", receita: 356000, despesas: 188000 },
  { month: "Nov", receita: 401000, despesas: 198000 },
  { month: "Dez", receita: 445000, despesas: 215000 },
];

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

export function RevenueChart() {
  // Calcular tendência
  const lastMonth = revenueData[revenueData.length - 1].receita;
  const previousMonth = revenueData[revenueData.length - 2].receita;
  const trend = ((lastMonth - previousMonth) / previousMonth) * 100;

  return (
    <Card className="glass-premium border-border/50 shadow-premium-md hover:shadow-premium-lg transition-premium animate-corporate-enter rounded-2xl overflow-hidden">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 gradient-mesh opacity-50 pointer-events-none" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Tendência de Receita</CardTitle>
            <CardDescription className="text-muted-foreground">Receita mensal vs despesas ao longo do ano</CardDescription>
          </div>
          <TrendBadge value={trend} size="sm" />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
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
      </CardContent>
    </Card>
  );
}
