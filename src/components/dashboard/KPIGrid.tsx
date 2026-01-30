import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PiggyBank,
  Loader2,
} from "lucide-react";
import { KPICard } from "./KPICard";
import { useTransactions } from "@/hooks/useTransactions";
import { useMemo } from "react";

export function KPIGrid() {
  const { transactions, isLoading, totals } = useTransactions();

  // Calcular dados reais dos KPIs
  const kpiData = useMemo(() => {
    const income = totals.income || 0;
    const expense = totals.expense || 0;
    const profit = income - expense;
    const margin = income > 0 ? (profit / income) * 100 : 0;

    // Calcular variação (comparar com mês anterior se houver dados suficientes)
    // Por enquanto, usar valores fixos para demonstração
    const incomeChange = transactions.length > 0 ? 12.5 : 0;
    const profitChange = transactions.length > 0 ? 8.2 : 0;
    const expenseChange = transactions.length > 0 ? 3.4 : 0;
    const marginChange = transactions.length > 0 ? 5.2 : 0;

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
        value: profit,
        prefix: "R$ ",
        change: profitChange,
        trend: profit >= 0 ? "up" as const : "down" as const,
        icon: <TrendingUp className="w-5 h-5" />,
        valueColor: profit >= 0 ? "success" as const : "danger" as const,
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
        value: margin,
        suffix: "%",
        change: marginChange,
        trend: margin >= 0 ? "up" as const : "down" as const,
        icon: <PiggyBank className="w-5 h-5" />,
        valueColor: margin >= 30 ? "success" as const : "default" as const,
        decimals: 1,
      },
    ];
  }, [transactions, totals]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className="bg-card/95 glass-premium rounded-2xl p-6 border border-border/50 animate-pulse flex items-center justify-center h-[180px]"
          >
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 stagger-children">
      {kpiData.map((kpi) => (
        <KPICard
          key={kpi.title}
          title={kpi.title}
          value={kpi.value}
          prefix={kpi.prefix}
          suffix={kpi.suffix}
          change={kpi.change}
          trend={kpi.trend}
          icon={kpi.icon}
          valueColor={kpi.valueColor}
          decimals={kpi.decimals}
        />
      ))}
    </div>
  );
}
