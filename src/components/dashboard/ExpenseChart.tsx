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
import { useTransactions } from "@/hooks/useTransactions";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { formatCurrencyBR, formatCompactBR } from "@/lib/currency";

const categoryColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
];

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
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-corporate-lg">
        <div className="flex items-center gap-2 mb-1">
          <div 
            className="w-3 h-3 rounded" 
            style={{ backgroundColor: data.payload.color }}
          />
          <span className="text-sm font-medium text-foreground">
            {data.payload.category}
          </span>
        </div>
        <p className="text-lg font-bold text-foreground">
          {formatCurrencyBR(data.value)}
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
      x={x + width + 6} 
      y={y + 14} 
      fill="hsl(var(--foreground))"
      fontSize={11}
      fontWeight={500}
    >
      {formatCurrencyBR(value)}
    </text>
  );
};

export function ExpenseChart() {
  const { transactions, isLoading } = useTransactions({ type: "expense", excludeTransfers: true });

  const expenseData = useMemo(() => {
    if (!transactions.length) return [];

    const categoryTotals: Record<string, number> = {};
    
    transactions.forEach((t) => {
      const category = t.category || "Outros";
      categoryTotals[category] = (categoryTotals[category] || 0) + Number(t.amount);
    });

    return Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([category, amount], index) => ({
        category,
        amount,
        color: categoryColors[index] || categoryColors[5],
      }));
  }, [transactions]);

  const total = expenseData.reduce((acc, item) => acc + item.amount, 0);

  if (isLoading) {
    return (
      <Card className="border-border shadow-corporate-sm rounded-xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton type="bar" height="h-[280px]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-corporate-sm hover:shadow-corporate-md transition-corporate rounded-xl overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">Despesas por Categoria</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Gastos acumulados por categoria</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-base font-bold text-foreground">{formatCurrencyBR(total)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {expenseData.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            <p>Sem despesas registradas</p>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={expenseData}
                layout="vertical"
                margin={{ top: 0, right: 70, left: 0, bottom: 0 }}
              >
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
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickFormatter={formatCompactBR}
                />
                <YAxis 
                  type="category"
                  dataKey="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.1)', radius: 4 }} />
                <Bar 
                  dataKey="amount" 
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                  animationDuration={1000}
                  animationEasing="ease-out"
                >
                  {expenseData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                    />
                  ))}
                  <LabelList dataKey="amount" content={<CustomLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
