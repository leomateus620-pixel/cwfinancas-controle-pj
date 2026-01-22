import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Tooltip,
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Dados de exemplo - serão substituídos por dados reais
const profitData = [
  { name: "Vendas de Produtos", value: 45, color: "hsl(var(--chart-1))" },
  { name: "Serviços", value: 28, color: "hsl(var(--chart-2))" },
  { name: "Assinaturas", value: 18, color: "hsl(var(--chart-3))" },
  { name: "Outros", value: 9, color: "hsl(var(--chart-4))" },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { name: string; color: string };
  }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-premium-lg">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: data.payload.color }}
          />
          <span className="text-sm font-medium text-foreground">
            {data.payload.name}
          </span>
        </div>
        <p className="text-lg font-semibold text-foreground mt-1">
          {data.value}%
        </p>
      </div>
    );
  }
  return null;
};

const renderLegend = (props: any) => {
  const { payload } = props;
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={`legend-${index}`} className="flex items-center gap-2">
          <div 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export function ProfitDistributionChart() {
  return (
    <Card className="shadow-premium-sm hover:shadow-premium-md transition-premium animate-fade-in border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Distribuição de Lucros</CardTitle>
        <CardDescription>Divisão por fonte de receita</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] md:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={profitData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {profitData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    className="transition-all duration-200 hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
