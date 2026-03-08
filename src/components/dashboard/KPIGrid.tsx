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

interface KPIGridProps {
  viewMode?: "operational" | "movement";
}

export function KPIGrid({ viewMode = "operational" }: KPIGridProps) {
  const {
    currentIncome,
    currentExpense,
    currentBalance,
    totalIncome,
    totalExpense,
    totalBalance,
    incomeChange,
    expenseChange,
    balanceChange,
    margin,
    marginChange,
    isLoading,
  } = usePeriodMetrics();

  const isMovement = viewMode === "movement";
  const income = isMovement ? totalIncome : currentIncome;
  const expense = isMovement ? totalExpense : currentExpense;
  const balance = isMovement ? totalBalance : currentBalance;
  const displayMargin = income > 0 ? (balance / income) * 100 : 0;

  const kpiData = useMemo(() => {
    return [
      {
        title: "Receita Total",
        value: income,
        prefix: "R$ ",
        change: incomeChange,
        trend: "up" as const,
        icon: <Wallet className="w-5 h-5" />,
        valueColor: "primary" as const,
      },
      {
        title: "Lucro Líquido",
        value: balance,
        prefix: "R$ ",
        change: balanceChange,
        trend: balance >= 0 ? "up" as const : "down" as const,
        icon: <TrendingUp className="w-5 h-5" />,
        valueColor: balance >= 0 ? "success" as const : "danger" as const,
      },
      {
        title: "Despesas Totais",
        value: expense,
        prefix: "R$ ",
        change: expenseChange,
        trend: "down" as const,
        icon: <TrendingDown className="w-5 h-5" />,
        valueColor: "default" as const,
      },
      {
        title: "Margem de Lucro",
        value: displayMargin,
        suffix: "%",
        change: marginChange,
        trend: displayMargin >= 0 ? "up" as const : "down" as const,
        icon: <PiggyBank className="w-5 h-5" />,
        valueColor: displayMargin >= 30 ? "success" as const : "default" as const,
        decimals: 1,
      },
    ];
  }, [income, expense, balance, incomeChange, expenseChange, balanceChange, displayMargin, marginChange]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className="liquid-glass-kpi p-5 animate-pulse flex items-center justify-center h-[160px]"
          >
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
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
