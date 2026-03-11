import { KPIGrid } from "@/components/dashboard/KPIGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { ProfitDistributionChart } from "@/components/dashboard/ProfitDistributionChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { DataQualityCard } from "@/components/dashboard/DataQualityCard";
import { Wallet, ArrowLeftRight, Sparkles } from "lucide-react";
import { formatCurrencyBR } from "@/lib/currency";

import { AnimatedValue } from "@/components/ui/animated-value";
import { TrendBadge } from "@/components/ui/trend-badge";
import { useOverviewData } from "@/hooks/useOverviewData";

export function OverviewPage() {
  const { 
    currentBalance, balanceChange, isLoading,
    transferIn, transferOut,
    transactions, recentTransactions,
  } = useOverviewData();

  const transferTotal = transferIn + transferOut;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Dashboard Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral das finanças da sua empresa
          </p>
        </div>
      </div>

      {/* LEVEL 1 — Hero Card */}
      <div className="liquid-glass-card-hero p-7 md:p-8">
        {/* Decorative orb */}
        <div style={{ position: 'absolute', inset: 0 }} className="pointer-events-none overflow-visible">
          <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-br from-primary/8 to-info/4 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-success/5 to-transparent rounded-full blur-2xl translate-y-1/4 -translate-x-1/4" />
        </div>
        
        <div className="flex items-start gap-5 relative z-10">
          <div className="p-4 rounded-2xl bg-primary/8 ring-1 ring-primary/10">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm text-muted-foreground font-medium">
                Resultado do Período
              </p>
              <Sparkles className="w-3.5 h-3.5 text-primary/50" />
            </div>
            <div className="flex items-baseline gap-4 flex-wrap">
              {isLoading ? (
                <span className="text-4xl md:text-5xl tracking-tight text-muted-foreground animate-pulse">...</span>
              ) : (
                <AnimatedValue
                  value={currentBalance}
                  prefix="R$ "
                  className="text-4xl md:text-5xl tracking-tight font-bold"
                  color={currentBalance >= 0 ? "primary" : "danger"}
                  format="currency"
                  duration={1800}
                />
              )}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <TrendBadge value={balanceChange} size="sm" />
              <span className="text-xs text-muted-foreground">vs. período anterior</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Info Card */}
      {transferTotal > 0 && (
        <div className="liquid-glass-card p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-info/8 ring-1 ring-info/10">
              <ArrowLeftRight className="w-5 h-5 text-info" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Transferências internas no período</p>
              <div className="flex gap-6 mt-1">
                <span className="text-xs text-muted-foreground">
                  Entradas: <span className="font-semibold text-success">{formatCurrencyBR(transferIn)}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Saídas: <span className="font-semibold text-destructive">{formatCurrencyBR(transferOut)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEVEL 2 — KPI Grid */}
      <KPIGrid />

      {/* LEVEL 3 — Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RevenueChart transactions={transactions} isLoading={isLoading} />
        <ExpenseChart transactions={transactions} isLoading={isLoading} />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ProfitDistributionChart transactions={transactions} isLoading={isLoading} />
        <RecentTransactions transactions={recentTransactions} isLoading={isLoading} />
        <DataQualityCard />
      </div>
    </div>
  );
}

export default OverviewPage;
