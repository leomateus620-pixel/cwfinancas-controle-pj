import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PiggyBank,
} from "lucide-react";
import { KPICard } from "./KPICard";

// Dados de exemplo - serão substituídos por dados reais
const kpiData = [
  {
    title: "Receita Total",
    value: "R$ 3.644.000",
    change: 12.5,
    trend: "up" as const,
    icon: <Wallet className="w-5 h-5" />,
    valueColor: "primary" as const,
  },
  {
    title: "Lucro Líquido",
    value: "R$ 1.457.000",
    change: 8.2,
    trend: "up" as const,
    icon: <TrendingUp className="w-5 h-5" />,
    valueColor: "success" as const,
  },
  {
    title: "Despesas Totais",
    value: "R$ 2.187.000",
    change: -3.4,
    trend: "down" as const,
    icon: <TrendingDown className="w-5 h-5" />,
    valueColor: "default" as const,
  },
  {
    title: "Margem de Lucro",
    value: "40,0%",
    change: 5.2,
    trend: "up" as const,
    icon: <PiggyBank className="w-5 h-5" />,
    valueColor: "success" as const,
  },
];

export function KPIGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 stagger-children">
      {kpiData.map((kpi) => (
        <KPICard
          key={kpi.title}
          title={kpi.title}
          value={kpi.value}
          change={kpi.change}
          trend={kpi.trend}
          icon={kpi.icon}
          valueColor={kpi.valueColor}
        />
      ))}
    </div>
  );
}
