import { useMemo } from "react";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import { HomeKPICard } from "@/components/home/HomeKPICard";
import { CaixaAtualCard } from "@/components/home/CaixaAtualCard";
import { CashEvolutionChart } from "@/components/home/CashEvolutionChart";
import { HealthScore } from "@/components/home/HealthScore";
import { AlertsPanel } from "@/components/home/AlertsPanel";
import { TopCategories } from "@/components/home/TopCategories";
import { ProfitQuality } from "@/components/home/ProfitQuality";
import { HomeEmptyState } from "@/components/home/HomeEmptyState";
import { HomeSkeletonLoading } from "@/components/home/HomeSkeletonLoading";

import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Hourglass,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCompactBR, formatCurrencyBR } from "@/lib/currency";

export default function HomePage() {
  const data = useHomeDashboard();

  // Generate insights from bank_balances history
  const insights = useMemo(() => {
    const list: string[] = [];
    const history = data.cashPositionHistory;

    if (history.length >= 2) {
      const last = history[history.length - 1];
      const prev = history[history.length - 2];
      if (prev.totalBalance !== 0) {
        const pct = ((last.totalBalance - prev.totalBalance) / Math.abs(prev.totalBalance)) * 100;
        const dir = pct >= 0 ? "avançou" : "recuou";
        list.push(`Caixa ${dir} ${Math.abs(pct).toFixed(1)}% entre ${prev.label} e ${last.label}.`);
      }
    }

    if (history.length >= 3) {
      const last3 = history.slice(-3);
      const increasing = last3[1].totalBalance > last3[0].totalBalance && last3[2].totalBalance > last3[1].totalBalance;
      const decreasing = last3[1].totalBalance < last3[0].totalBalance && last3[2].totalBalance < last3[1].totalBalance;
      if (increasing) list.push("Tendência de crescimento nos últimos 3 meses consecutivos.");
      else if (decreasing) list.push("Atenção: caixa em queda nos últimos 3 meses consecutivos.");
    }

    // Volatility detection (std dev > 20% of mean over available data)
    if (history.length >= 4) {
      const values = history.map(p => p.totalBalance);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      if (mean > 0) {
        const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        const cv = (stdDev / mean) * 100;
        if (cv > 30) list.push("Alta volatilidade detectada no saldo do caixa — revise movimentações atípicas.");
      }
    }

    if (history.length > 0) {
      const last = history[history.length - 1];
      list.push(`Posição em ${last.label}: ${formatCurrencyBR(last.totalBalance)}.`);
    }

    if (history.length < 2) {
      list.push("Importe mais meses de saldos bancários para análise de tendência.");
    }

    return list.slice(0, 3);
  }, [data.cashPositionHistory]);

  if (data.isLoading) {
    return (
      <div className="home-glass-bg min-h-[calc(100vh-64px)] -m-5 md:-m-6 p-5 md:p-8">
        <div className="max-w-[1440px] mx-auto">
          <HomeSkeletonLoading />
        </div>
      </div>
    );
  }

  const now = new Date();
  const formattedDate = format(now, "EEEE, d 'de' MMMM", { locale: ptBR });
  const lastSync = data.lastSyncAt
    ? `Última atualização: ${format(new Date(data.lastSyncAt), "dd/MM 'às' HH:mm")}`
    : null;

  return (
    <div className="home-glass-bg min-h-[calc(100vh-64px)] -m-5 md:-m-6 p-5 md:p-8">
      <div className="max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-foreground text-2xl md:text-3xl font-bold tracking-tight">
            {data.greeting}, <span className="gradient-text-primary">{data.companyName}</span>!
          </h1>
          <p className="text-muted-foreground/70 text-sm mt-1">Aqui está seu resumo financeiro diário.</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-muted-foreground/50 text-xs capitalize">{formattedDate}</span>
            {lastSync && (
              <>
                <span className="text-border">•</span>
                <span className="text-muted-foreground/50 text-xs">{lastSync}</span>
              </>
            )}
          </div>
        </div>

        {!data.hasData ? (
          <HomeEmptyState />
        ) : (
          <div className="space-y-5">
            {/* Row 1: 4 compact KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <HomeKPICard
                label="Entradas do Mês"
                value={formatCompactBR(data.monthIncome)}
                icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                tooltip="Soma de todas as receitas operacionais registradas no mês corrente."
                href="/income"
                valueColor="text-emerald-600"
                delay={60}
              />
              <HomeKPICard
                label="Saídas do Mês"
                value={formatCompactBR(data.monthExpense)}
                icon={<TrendingDown className="w-5 h-5 text-red-600" />}
                tooltip="Soma de todas as despesas operacionais registradas no mês corrente."
                href="/expenses"
                valueColor="text-red-600"
                delay={120}
              />
              <HomeKPICard
                label="Resultado do Mês"
                value={formatCompactBR(data.monthResult)}
                icon={<BarChart3 className="w-5 h-5 text-blue-600" />}
                tooltip="Diferença entre entradas e saídas operacionais do mês corrente."
                href="/overview"
                valueColor={data.monthResult >= 0 ? "text-emerald-600" : "text-red-600"}
                trend={{ value: data.variationPercent, label: "vs mês anterior" }}
                delay={180}
              />
              <HomeKPICard
                label="Fôlego de Caixa"
                value={data.runwayDays === null ? "Infinito" : `${data.runwayDays} dias`}
                icon={<Hourglass className="w-5 h-5 text-purple-600" />}
                tooltip={
                  data.runwaySource === "bank_balances"
                    ? "Baseado no saldo bancário consolidado e na média de despesas operacionais dos últimos 30 dias."
                    : "Estimativa de quantos dias o saldo atual cobre, com base na média de despesas operacionais dos últimos 30 dias."
                }
                href="/cash-flow"
                subtitle={data.avgDailyExpense > 0 ? `~${formatCompactBR(data.avgDailyExpense)}/dia em despesas` : undefined}
                valueColor={
                  data.runwayDays === null ? "text-emerald-600" :
                  data.runwayDays > 60 ? "text-emerald-600" :
                  data.runwayDays > 30 ? "text-amber-600" : "text-red-600"
                }
                delay={240}
              />
            </div>

            {/* Row 2: Caixa Atual + Cash Evolution (50/50) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CaixaAtualCard
                currentBalance={data.currentBalance}
                monthIncome={data.monthIncome}
                monthExpense={data.monthExpense}
                delay={300}
              />
              <CashEvolutionChart
                data={data.cashPositionHistory}
                accountNames={data.cashAccountNames}
                insights={insights}
                isEmpty={data.cashPositionHistory.length === 0 && !data.isLoading}
                delay={360}
              />
            </div>

            {/* Row 3: Health + Top Despesas + Alerts + Profit Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <HealthScore
                score={data.healthScore}
                factors={data.healthFactors}
                trendLabel={data.trendLabel}
                trendPercent={data.trendPercent}
                runwayDays={data.runwayDays}
                delay={420}
              />
              <TopCategories categories={data.topExpenseCategories} delay={480} />
              <AlertsPanel alerts={data.alerts} delay={540} />
              <ProfitQuality
                value={data.profitQuality}
                prevValue={data.profitQualityPrev}
                delay={600}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
