import { KPIGrid } from "@/components/dashboard/KPIGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { ProfitDistributionChart } from "@/components/dashboard/ProfitDistributionChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OverviewPage() {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Cabeçalho da página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Visão Geral Financeira
          </h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo de volta! Aqui está o resumo das suas finanças.
          </p>
        </div>
        <Button variant="outline" className="gap-2 self-start">
          <Calendar className="w-4 h-4" />
          <span>1 Jan - 31 Dez, 2024</span>
        </Button>
      </div>

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
