import { useMemo } from "react";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import { HomeKPICard } from "@/components/home/HomeKPICard";
import { DailySummary } from "@/components/home/DailySummary";
import { HealthScore } from "@/components/home/HealthScore";
import { AlertsPanel } from "@/components/home/AlertsPanel";
import { QuickLinks } from "@/components/home/QuickLinks";
import { TopCategories } from "@/components/home/TopCategories";
import { HomeEmptyState } from "@/components/home/HomeEmptyState";
import { HomeSkeletonLoading } from "@/components/home/HomeSkeletonLoading";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  CreditCard,
  ArrowUpDown,
  Hourglass,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatBRL(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}mi`;
  }
  if (Math.abs(value) >= 10_000) {
    return `R$ ${(value / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`;
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatFullBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function HomePage() {
  const data = useHomeDashboard();

  const insights = useMemo(() => {
    const list: string[] = [];

    if (data.dailyTrend.length >= 2) {
      const last = data.dailyTrend[data.dailyTrend.length - 1]?.value ?? 0;
      const prev = data.dailyTrend[data.dailyTrend.length - 2]?.value ?? 0;
      if (prev !== 0) {
        const pct = ((last - prev) / Math.abs(prev)) * 100;
        list.push(`Seu caixa ${pct >= 0 ? "cresceu" : "caiu"} ${Math.abs(pct).toFixed(1)}% em relação a ontem.`);
      }
    }

    if (data.topExpenseCategories.length > 0) {
      const top = data.topExpenseCategories[0];
      list.push(`A categoria "${top.name}" concentrou ${Math.round(top.percent)}% das despesas este mês.`);
    }

    if (data.receivables > 0) {
      list.push(`Você tem ${formatFullBRL(data.receivables)} em contas a receber pendentes.`);
    }

    if (list.length === 0) {
      list.push("Importe seus dados para ver insights automáticos aqui.");
    }

    return list.slice(0, 3);
  }, [data]);

  if (data.isLoading) {
    return (
      <div className="home-dark-bg min-h-[calc(100vh-64px)] -m-5 md:-m-6 p-5 md:p-8">
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
    <div className="home-dark-bg min-h-[calc(100vh-64px)] -m-5 md:-m-6 p-5 md:p-8">
      <div className="max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-white text-2xl md:text-3xl font-bold tracking-tight">
            {data.greeting}, <span className="gradient-text-primary">{data.companyName}</span>!
          </h1>
          <p className="text-white/40 text-sm mt-1">Aqui está seu resumo financeiro diário.</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-white/25 text-xs capitalize">{formattedDate}</span>
            {lastSync && (
              <>
                <span className="text-white/10">•</span>
                <span className="text-white/25 text-xs">{lastSync}</span>
              </>
            )}
          </div>
        </div>

        {!data.hasData ? (
          <HomeEmptyState />
        ) : (
          <div className="space-y-5">
            {/* KPI Mosaic */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <HomeKPICard
                  label="Caixa Atual"
                  value={formatBRL(data.currentBalance)}
                  icon={<Wallet className="w-5 h-5 text-blue-400" />}
                  tooltip="Saldo líquido: total de receitas menos despesas de todas as transações importadas."
                  href="/cash-flow"
                  large
                  valueColor={data.currentBalance >= 0 ? "text-emerald-400" : "text-red-400"}
                  delay={0}
                />
              </div>
              <HomeKPICard
                label="Entradas do Mês"
                value={formatBRL(data.monthIncome)}
                icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                tooltip="Soma de todas as receitas registradas no mês corrente."
                href="/income"
                valueColor="text-emerald-400"
                delay={60}
              />
              <HomeKPICard
                label="Saídas do Mês"
                value={formatBRL(data.monthExpense)}
                icon={<TrendingDown className="w-5 h-5 text-red-400" />}
                tooltip="Soma de todas as despesas registradas no mês corrente."
                href="/expenses"
                valueColor="text-red-400"
                delay={120}
              />

              <HomeKPICard
                label="Resultado do Mês"
                value={formatBRL(data.monthResult)}
                icon={<BarChart3 className="w-5 h-5 text-blue-400" />}
                tooltip="Diferença entre entradas e saídas do mês corrente."
                href="/overview"
                valueColor={data.monthResult >= 0 ? "text-emerald-400" : "text-red-400"}
                trend={{ value: data.variationPercent, label: "vs mês anterior" }}
                delay={180}
              />
              <HomeKPICard
                label="Contas a Receber"
                value={formatBRL(data.receivables)}
                icon={<Clock className="w-5 h-5 text-amber-400" />}
                tooltip="Valor total de faturas com status pendente."
                href="/invoices"
                delay={240}
              />
              <HomeKPICard
                label="Contas a Pagar"
                value={formatBRL(data.payables)}
                icon={<CreditCard className="w-5 h-5 text-orange-400" />}
                tooltip="Despesas futuras programadas."
                href="/expenses"
                delay={300}
              />
              {data.runwayDays !== null && (
                <HomeKPICard
                  label="Fôlego de Caixa"
                  value={`${data.runwayDays} dias`}
                  icon={<Hourglass className="w-5 h-5 text-purple-400" />}
                  tooltip="Estimativa de quantos dias o saldo atual cobre, com base na média de despesas dos últimos 90 dias."
                  valueColor={data.runwayDays > 60 ? "text-emerald-400" : data.runwayDays > 30 ? "text-amber-400" : "text-red-400"}
                  delay={360}
                />
              )}
            </div>

            {/* Middle row: Summary + Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <DailySummary
                  dailyTrend={data.dailyTrend}
                  insights={insights}
                  delay={420}
                />
              </div>
              <HealthScore
                score={data.healthScore}
                factors={data.healthFactors}
                delay={480}
              />
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <TopCategories categories={data.topExpenseCategories} delay={540} />
              <AlertsPanel alerts={data.alerts} delay={600} />
              <QuickLinks delay={660} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
