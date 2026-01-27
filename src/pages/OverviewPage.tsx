import { KPIGrid } from "@/components/dashboard/KPIGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { ProfitDistributionChart } from "@/components/dashboard/ProfitDistributionChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { Calendar, Wallet, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CorporateCard } from "@/components/corporate/CorporateCard";
import { AnimatedValue } from "@/components/ui/animated-value";
import { TrendBadge } from "@/components/ui/trend-badge";

export function OverviewPage() {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Cabeçalho da página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            Dashboard Financeiro
            <Sparkles className="w-6 h-6 text-primary animate-pulse-glow" />
          </h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo de volta! Aqui está o resumo das suas finanças.
          </p>
        </div>
        <Button variant="outline" className="gap-2 self-start rounded-xl border-border hover:bg-accent group transition-premium">
          <Calendar className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span>1 Jan - 31 Dez, 2024</span>
        </Button>
      </div>

      {/* Card de Saldo Principal */}
      <CorporateCard className="bg-gradient-to-br from-primary/8 via-card to-card relative overflow-hidden group hover-glow-primary">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-chart-2/10 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/15 transition-colors group-hover:scale-105 duration-300">
            <Wallet className="w-8 h-8 text-primary group-hover:animate-float" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1.5">Saldo Total da Empresa</p>
            <div className="flex items-baseline gap-3">
              <AnimatedValue
                value={253412}
                prefix="R$ "
                className="text-4xl md:text-5xl tracking-tight"
                color="primary"
                glow
                format="currency"
                duration={2000}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <TrendBadge value={12.5} size="sm" animated />
              <span className="text-sm text-muted-foreground">em relação ao mês anterior</span>
            </div>
          </div>
        </div>
      </CorporateCard>

      {/* Cards de KPI */}
      <KPIGrid />

      {/* Grid de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart />
        <ExpenseChart />
      </div>

      {/* Seção Inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfitDistributionChart />
        <RecentTransactions />
      </div>
    </div>
  );
}

export default OverviewPage;
