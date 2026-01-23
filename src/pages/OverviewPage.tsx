import { KPIGrid } from "@/components/dashboard/KPIGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { ProfitDistributionChart } from "@/components/dashboard/ProfitDistributionChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { Calendar, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CorporateCard } from "@/components/corporate/CorporateCard";

export function OverviewPage() {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Cabeçalho da página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Dashboard Financeiro
          </h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo de volta! Aqui está o resumo das suas finanças.
          </p>
        </div>
        <Button variant="outline" className="gap-2 self-start rounded-xl border-border hover:bg-accent">
          <Calendar className="w-4 h-4" />
          <span>1 Jan - 31 Dez, 2024</span>
        </Button>
      </div>

      {/* Card de Saldo Principal */}
      <CorporateCard className="bg-gradient-to-br from-primary/5 via-card to-card">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-primary/10">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Saldo Total da Empresa</p>
            <p className="text-4xl md:text-5xl font-bold text-primary tracking-tight">
              R$ 253.412,00
            </p>
            <p className="text-sm text-success font-medium mt-1 flex items-center gap-1">
              <span>↑ 12.5%</span>
              <span className="text-muted-foreground">em relação ao mês anterior</span>
            </p>
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
