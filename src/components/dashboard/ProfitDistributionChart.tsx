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
      <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-corporate-lg">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: data.payload.color }}
          />
          <span className="text-sm font-medium text-foreground">
            {data.payload.name}
          </span>
        </div>
        <p className="text-lg font-bold text-foreground mt-1">
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
            className="w-3 h-3 rounded-full" 
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
    <Card className="bg-card/95 backdrop-blur-md border-border shadow-corporate-md hover:shadow-corporate-lg transition-corporate animate-corporate-enter rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Distribuição de Receita</CardTitle>
        <CardDescription className="text-muted-foreground">Divisão por fonte de receita</CardDescription>
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
