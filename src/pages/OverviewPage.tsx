import { KPIGrid } from "@/components/dashboard/KPIGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { ProfitDistributionChart } from "@/components/dashboard/ProfitDistributionChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { DataQualityCard } from "@/components/dashboard/DataQualityCard";
import { Wallet, AlertTriangle } from "lucide-react";

import { CorporateCard } from "@/components/corporate/CorporateCard";
import { AnimatedValue } from "@/components/ui/animated-value";
import { TrendBadge } from "@/components/ui/trend-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePeriodMetrics } from "@/hooks/usePeriodMetrics";

export function OverviewPage() {
  const { currentBalance, balanceChange, hasReconciliationWarnings, isLoading } = usePeriodMetrics();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Dashboard Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral das finanças da sua empresa
          </p>
        </div>
      </div>

      {/* DRE Reconciliation Warning */}
      {hasReconciliationWarnings && (
        <Alert className="border-warning/50 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm text-muted-foreground">
            Diferença detectada entre transações e DRE neste período. Verifique a reconciliação na página de DRE.
          </AlertDescription>
        </Alert>
      )}

      {/* Hero Balance Card */}
      <CorporateCard className="bg-gradient-to-br from-primary/5 via-card to-card relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-primary/8 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 group-hover:scale-110 transition-transform duration-500" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3.5 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
            <Wallet className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Resultado do Período</p>
            <div className="flex items-baseline gap-3">
              {isLoading ? (
                <span className="text-3xl md:text-4xl tracking-tight text-muted-foreground animate-pulse">...</span>
              ) : (
                <AnimatedValue
                  value={currentBalance}
                  prefix="R$ "
                  className="text-3xl md:text-4xl tracking-tight"
                  color={currentBalance >= 0 ? "primary" : "danger"}
                  format="currency"
                  duration={1800}
                />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <TrendBadge value={balanceChange} size="sm" />
              <span className="text-xs text-muted-foreground">vs. período anterior</span>
            </div>
          </div>
        </div>
      </CorporateCard>

      {/* KPI Grid */}
      <KPIGrid />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueChart />
        <ExpenseChart />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ProfitDistributionChart />
        <RecentTransactions />
        <DataQualityCard />
      </div>
    </div>
  );
}

export default OverviewPage;
