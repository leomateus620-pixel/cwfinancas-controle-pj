import { useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Briefcase, 
  Megaphone, 
  Settings, 
  Monitor, 
  Building2, 
  MoreHorizontal 
} from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

const categoryIcons: Record<string, any> = {
  "Salários": Briefcase,
  "Marketing": Megaphone,
  "Operações": Settings,
  "Tecnologia": Monitor,
  "Escritório": Building2,
  "Pessoal": Briefcase,
  "Geral": MoreHorizontal,
};

const categoryColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
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
    payload: { category: string; color: string };
  }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const total = payload[0].payload as unknown as { total: number };
    return (
      <div className="glass-premium rounded-xl p-4 shadow-premium-lg border border-border/50 animate-slide-up-fade">
        <div className="flex items-center gap-3 mb-2">
          <div 
            className="w-4 h-4 rounded-md" 
            style={{ 
              backgroundColor: data.payload.color,
              boxShadow: `0 0 10px ${data.payload.color}50`
            }}
          />
          <span className="text-sm font-semibold text-foreground">
            {data.payload.category}
          </span>
        </div>
        <p className="text-2xl font-bold text-foreground">
          {formatCurrency(data.value)}
        </p>
      </div>
    );
  }
  return null;
};

const CustomLabel = (props: any) => {
  const { x, y, width, value } = props;
  return (
    <text 
      x={x + width + 8} 
      y={y + 16} 
      fill="hsl(var(--foreground))"
      fontSize={12}
      fontWeight={600}
      className="animate-fade-in"
    >
      {formatCurrency(value)}
    </text>
  );
};

export function ExpenseChart() {
  const { transactions, isLoading } = useTransactions({ type: "expense" });

  // Agrupar despesas por categoria
  const expenseData = useMemo(() => {
    if (!transactions.length) return [];

    const categoryTotals: Record<string, number> = {};
    
    transactions.forEach((t) => {
      const category = t.category || "Outros";
      categoryTotals[category] = (categoryTotals[category] || 0) + Number(t.amount);
    });

    // Ordenar por valor e pegar as top 6
    return Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([category, amount], index) => ({
        category,
        amount,
        color: categoryColors[index] || categoryColors[5],
        icon: categoryIcons[category] || MoreHorizontal,
      }));
  }, [transactions]);

  const total = expenseData.reduce((acc, item) => acc + item.amount, 0);

  if (isLoading) {
    return (
      <Card className="glass-premium border-border/50 shadow-premium-md rounded-2xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton type="bar" height="h-[300px] md:h-[350px]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-premium border-border/50 shadow-premium-md hover:shadow-premium-lg transition-premium animate-corporate-enter rounded-2xl overflow-hidden relative">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Despesas por Categoria</CardTitle>
            <CardDescription className="text-muted-foreground">Gastos acumulados por categoria</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(total)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {expenseData.length === 0 ? (
          <div className="h-[300px] md:h-[350px] flex items-center justify-center text-muted-foreground">
            <p>Sem despesas registradas</p>
          </div>
        ) : (
          <>
            <div className="h-[300px] md:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={expenseData}
                  layout="vertical"
                  margin={{ top: 0, right: 80, left: 0, bottom: 0 }}
                >
                  <defs>
                    {expenseData.map((entry, index) => (
                      <linearGradient key={`gradient-${index}`} id={`barGradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={entry.color} stopOpacity={0.9}/>
                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.6}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="4 4" 
                    stroke="hsl(var(--border))" 
                    horizontal={true}
                    vertical={false}
                    strokeOpacity={0.5}
                  />
                  <XAxis 
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 500 }}
                    tickFormatter={formatCurrency}
                  />
                  <YAxis 
                    type="category"
                    dataKey="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 500 }}
                    width={85}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.15)', radius: 8 }} />
                  <Bar 
                    dataKey="amount" 
                    radius={[0, 10, 10, 0]}
                    maxBarSize={28}
                    isAnimationActive={true}
                    animationBegin={0}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  >
                    {expenseData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#barGradient-${index})`}
                        className="transition-all duration-300 hover:opacity-80"
                        style={{ filter: `drop-shadow(0 2px 4px ${entry.color}30)` }}
                      />
                    ))}
                    <LabelList dataKey="amount" content={<CustomLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Category legend with icons */}
            <div className="flex flex-wrap justify-center gap-3 mt-4 pt-4 border-t border-border/50">
              {expenseData.slice(0, 4).map((item, index) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={index} 
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                    <span className="text-xs font-medium text-muted-foreground">{item.category}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
