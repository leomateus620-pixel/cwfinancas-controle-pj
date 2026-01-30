import { useState, useMemo } from "react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Tooltip,
  Sector
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AnimatedValue } from "@/components/ui/animated-value";
import { useTransactions } from "@/hooks/useTransactions";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

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
      <div className="glass-premium rounded-xl p-4 shadow-premium-lg border border-border/50 animate-slide-up-fade">
        <div className="flex items-center gap-3">
          <div 
            className="w-4 h-4 rounded-full" 
            style={{ 
              backgroundColor: data.payload.color,
              boxShadow: `0 0 12px ${data.payload.color}60`
            }}
          />
          <span className="text-sm font-semibold text-foreground">
            {data.payload.name}
          </span>
        </div>
        <p className="text-3xl font-bold text-foreground mt-2">
          {data.payload.percentage.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

// Active shape for hover state
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ 
          filter: `drop-shadow(0 0 12px ${fill}60)`,
          transition: "all 0.3s ease"
        }}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 12}
        outerRadius={outerRadius + 16}
        fill={fill}
        opacity={0.3}
      />
    </g>
  );
};

export function ProfitDistributionChart() {
  const [activeIndex, setActiveIndex] = useState(-1);
  const { transactions, isLoading } = useTransactions({ type: "income" });

  // Agrupar receitas por categoria
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

    // Ordenar por valor e calcular percentuais
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
      <Card className="glass-premium border-border/50 shadow-premium-md rounded-2xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Distribuição de Receita</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton type="pie" height="h-[300px] md:h-[350px]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-premium border-border/50 shadow-premium-md hover:shadow-premium-lg transition-premium animate-corporate-enter rounded-2xl overflow-hidden relative">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
      
      <CardHeader className="relative z-10">
        <CardTitle className="text-lg font-semibold text-foreground">Distribuição de Receita</CardTitle>
        <CardDescription className="text-muted-foreground">Divisão por fonte de receita</CardDescription>
      </CardHeader>
      <CardContent className="relative z-10">
        {profitData.length === 0 ? (
          <div className="h-[300px] md:h-[350px] flex items-center justify-center text-muted-foreground">
            <p>Sem receitas registradas</p>
          </div>
        ) : (
          <>
            <div className="h-[300px] md:h-[350px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {profitData.map((entry, index) => (
                      <linearGradient key={`pieGradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={entry.color} stopOpacity={1}/>
                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.7}/>
                      </linearGradient>
                    ))}
                    <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.15"/>
                    </filter>
                  </defs>
                  <Pie
                    data={profitData}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                    isAnimationActive={true}
                    animationBegin={0}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    style={{ filter: "url(#pieShadow)" }}
                  >
                    {profitData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#pieGradient-${index})`}
                        className="transition-all duration-300 cursor-pointer"
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Center value */}
              <div className="absolute top-[45%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <AnimatedValue 
                  value={Math.round(totalPercentage)} 
                  suffix="%" 
                  className="text-4xl font-bold"
                  color="primary"
                  glow
                  duration={1500}
                />
                <p className="text-xs text-muted-foreground mt-1 font-medium">Total</p>
              </div>
            </div>
            
            {/* Legend */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              {profitData.map((entry, index) => (
                <div 
                  key={`legend-${index}`} 
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 cursor-pointer ${
                    activeIndex === index 
                      ? 'bg-muted/80 shadow-sm' 
                      : 'hover:bg-muted/50'
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(-1)}
                >
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ 
                      backgroundColor: entry.color,
                      boxShadow: activeIndex === index ? `0 0 12px ${entry.color}60` : 'none',
                      transition: 'box-shadow 0.3s ease'
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">{entry.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
