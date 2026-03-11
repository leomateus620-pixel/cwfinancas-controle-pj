import { useState, useMemo } from "react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Tooltip,
  Sector
} from "recharts";
import { AnimatedValue } from "@/components/ui/animated-value";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { Transaction } from "@/hooks/useTransactions";

interface ProfitDistributionChartProps {
  transactions?: Transaction[];
  isLoading?: boolean;
}

const categoryColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { name: string; color: string; percentage: number };
  }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="liquid-glass-tooltip">
        <div className="flex items-center gap-2">
          <div 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ backgroundColor: data.payload.color }}
          />
          <span className="text-sm font-medium text-foreground">
            {data.payload.name}
          </span>
        </div>
        <p className="text-xl font-bold text-foreground mt-1">
          {data.payload.percentage.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius - 2}
      outerRadius={outerRadius + 5}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
};

export function ProfitDistributionChart({ transactions: txProp, isLoading: loadingProp }: ProfitDistributionChartProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const allTransactions = txProp ?? [];
  const isLoading = loadingProp ?? false;

  // Filter to income only
  const transactions = useMemo(() => allTransactions.filter(t => t.type === "income"), [allTransactions]);

  const profitData = useMemo(() => {
    if (!transactions.length) return [];

    const categoryTotals: Record<string, number> = {};
    let total = 0;
    
    transactions.forEach((t) => {
      const category = t.category || "Outros";
      const amount = Number(t.amount);
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
      total += amount;
    });

    if (total === 0) return [];

    return Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value], index) => ({
        name,
        value,
        percentage: (value / total) * 100,
        color: categoryColors[index] || categoryColors[4],
      }));
  }, [transactions]);

  const totalPercentage = profitData.reduce((acc, item) => acc + item.percentage, 0);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(-1);
  };

  if (isLoading) {
    return (
      <div className="liquid-glass-card p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Distribuição de Receita</h3>
        <ChartSkeleton type="pie" height="h-[280px]" />
      </div>
    );
  }

  return (
    <div className="liquid-glass-card p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Distribuição de Receita</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Divisão por fonte de receita</p>
      </div>
      {profitData.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
          <p>Sem receitas registradas</p>
        </div>
      ) : (
        <>
          <div className="h-[200px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={profitData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  onMouseEnter={onPieEnter}
                  onMouseLeave={onPieLeave}
                  animationDuration={1000}
                  animationEasing="ease-out"
                >
                  {profitData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      stroke="rgba(255,255,255,0.8)"
                      strokeWidth={2}
                      className="cursor-pointer"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center value */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <AnimatedValue 
                value={Math.round(totalPercentage)} 
                suffix="%" 
                className="text-2xl font-bold"
                color="default"
                duration={1200}
              />
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Total</p>
            </div>
          </div>
          
          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {profitData.map((entry, index) => (
              <div 
                key={`legend-${index}`} 
                className={`flex items-center gap-2 p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                  activeIndex === index 
                    ? 'bg-primary/5 ring-1 ring-primary/10' 
                    : 'hover:bg-muted/30'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(-1)}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{entry.name}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{entry.percentage.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
