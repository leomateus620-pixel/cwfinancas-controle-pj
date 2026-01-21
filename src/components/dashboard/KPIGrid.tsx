import { DollarSign, TrendingUp, Percent, Droplets } from "lucide-react";
import { KPICard } from "./KPICard";

// Sample data - will be replaced with real data from Excel upload
const kpiData = [
  {
    title: "Total Revenue",
    value: "$1,284,592",
    change: 12.5,
    trend: "up" as const,
    icon: <DollarSign className="w-5 h-5 text-primary" />,
  },
  {
    title: "Net Profit",
    value: "$342,847",
    change: 8.2,
    trend: "up" as const,
    icon: <TrendingUp className="w-5 h-5 text-success" />,
  },
  {
    title: "ROI",
    value: "24.8%",
    change: -2.1,
    trend: "down" as const,
    icon: <Percent className="w-5 h-5 text-warning" />,
  },
  {
    title: "Liquidity Ratio",
    value: "1.82",
    change: 0.3,
    trend: "up" as const,
    icon: <Droplets className="w-5 h-5 text-info" />,
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
