import { KPIGrid } from "@/components/dashboard/KPIGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { ProfitDistributionChart } from "@/components/dashboard/ProfitDistributionChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { DataQualityCard } from "@/components/dashboard/DataQualityCard";
import { Wallet, AlertTriangle, ArrowLeftRight } from "lucide-react";
import { formatCurrencyBR } from "@/lib/currency";

import { CorporateCard } from "@/components/corporate/CorporateCard";
import { AnimatedValue } from "@/components/ui/animated-value";
import { TrendBadge } from "@/components/ui/trend-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePeriodMetrics } from "@/hooks/usePeriodMetrics";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function OverviewPage() {
  const { 
    currentBalance, balanceChange, hasReconciliationWarnings, isLoading,
    transferIn, transferOut, totalBalance, totalIncome, totalExpense,
    currentIncome, currentExpense,
  } = usePeriodMetrics();

  const [showMovement, setShowMovement] = useState(false);

  const displayBalance = showMovement ? totalBalance : currentBalance;
  const displayBalanceChange = balanceChange;
  const transferTotal = transferIn + transferOut;

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
        <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5">
          <Label htmlFor="view-mode" className="text-xs text-muted-foreground font-medium cursor-pointer">
            {showMovement ? "Movimentação (Caixa)" : "Operacional (DRE)"}
          </Label>
          <Switch 
            id="view-mode" 
            checked={showMovement} 
            onCheckedChange={setShowMovement}
          />
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
            <p className="text-sm text-muted-foreground font-medium mb-1">
              {showMovement ? "Resultado (Movimentação)" : "Resultado do Período"}
            </p>
            <div className="flex items-baseline gap-3">
              {isLoading ? (
                <span className="text-3xl md:text-4xl tracking-tight text-muted-foreground animate-pulse">...</span>
              ) : (
                <AnimatedValue
                  value={displayBalance}
                  prefix="R$ "
                  className="text-3xl md:text-4xl tracking-tight"
                  color={displayBalance >= 0 ? "primary" : "danger"}
                  format="currency"
                  duration={1800}
                />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <TrendBadge value={displayBalanceChange} size="sm" />
              <span className="text-xs text-muted-foreground">vs. período anterior</span>
            </div>
          </div>
        </div>
      </CorporateCard>

      {/* Transfer Info Card */}
      {transferTotal > 0 && (
        <CorporateCard className="bg-gradient-to-br from-info/5 via-card to-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-info/10">
              <ArrowLeftRight className="w-6 h-6 text-info" />
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
        </CorporateCard>
      )}

      {/* KPI Grid */}
      <KPIGrid viewMode={showMovement ? "movement" : "operational"} />

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
