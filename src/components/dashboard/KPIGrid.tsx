import { DollarSign, TrendingUp, Percent, Wallet } from "lucide-react";
import { KPICard } from "./KPICard";

// Dados de exemplo - serão substituídos por dados reais do upload Excel
const kpiData = [
  {
    title: "Receita Total",
    value: "R$ 3.644.000",
    change: 12.5,
    changeLabel: "vs período anterior",
    icon: <DollarSign className="w-5 h-5 text-primary" />,
    trend: "up" as const,
  },
  {
    title: "Lucro Líquido",
    value: "R$ 1.457.000",
    change: 8.2,
    changeLabel: "vs período anterior",
    icon: <TrendingUp className="w-5 h-5 text-success" />,
    trend: "up" as const,
  },
  {
    title: "ROI",
    value: "24,8%",
    change: -2.1,
    changeLabel: "vs período anterior",
    icon: <Percent className="w-5 h-5 text-warning" />,
    trend: "down" as const,
  },
  {
    title: "Índice de Liquidez",
    value: "1.82",
    change: 0,
    changeLabel: "estável",
    icon: <Wallet className="w-5 h-5 text-info" />,
    trend: "neutral" as const,
  },
];

export function KPIGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {kpiData.map((kpi, index) => (
        <div 
          key={kpi.title} 
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <KPICard {...kpi} />
        </div>
      ))}
    </div>
  );
}
