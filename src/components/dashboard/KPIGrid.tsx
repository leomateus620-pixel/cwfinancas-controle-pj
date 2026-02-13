import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PiggyBank,
  Loader2,
} from "lucide-react";
import { KPICard } from "./KPICard";
import { usePeriodMetrics } from "@/hooks/usePeriodMetrics";
import { useMemo } from "react";

export function KPIGrid() {
  const {
    currentIncome,
    currentExpense,
    currentBalance,
    incomeChange,
    expenseChange,
    balanceChange,
    margin,
    marginChange,
    isLoading,
  } = usePeriodMetrics();

  const kpiData = useMemo(() => {
    return [
      {
        title: "Receita Total",
        value: currentIncome,
        prefix: "R$ ",
        change: incomeChange,
        trend: "up" as const,
        icon: <Wallet className="w-5 h-5" />,
        valueColor: "primary" as const,
      },
      {
        title: "Lucro Líquido",
        value: currentBalance,
        prefix: "R$ ",
        change: balanceChange,
        trend: currentBalance >= 0 ? "up" as const : "down" as const,
        icon: <TrendingUp className="w-5 h-5" />,
        valueColor: currentBalance >= 0 ? "success" as const : "danger" as const,
      },
      {
        title: "Despesas Totais",
        value: currentExpense,
        prefix: "R$ ",
        change: expenseChange,
        trend: "down" as const,
        icon: <TrendingDown className="w-5 h-5" />,
        valueColor: "default" as const,
      },
      {
        title: "Margem de Lucro",
        value: margin,
        suffix: "%",
        change: marginChange,
        trend: margin >= 0 ? "up" as const : "down" as const,
        icon: <PiggyBank className="w-5 h-5" />,
        valueColor: margin >= 30 ? "success" as const : "default" as const,
        decimals: 1,
      },
    ];
  }, [currentIncome, currentExpense, currentBalance, incomeChange, expenseChange, balanceChange, margin, marginChange]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className="bg-card rounded-xl p-5 border border-border shadow-corporate-sm animate-pulse flex items-center justify-center h-[160px]"
          >
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
      {kpiData.map((kpi) => (
        <KPICard
          key={kpi.title}
          title={kpi.title}
          value={kpi.value}
          prefix={kpi.prefix}
          suffix={kpi.suffix}
          change={kpi.change}
          changeLabel="vs período anterior"
          trend={kpi.trend}
          icon={kpi.icon}
          valueColor={kpi.valueColor}
          decimals={kpi.decimals}
        />
      ))}
    </div>
  );
}
