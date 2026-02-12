import { 
  ArrowLeftRight, 
  TrendingUp, 
  TrendingDown, 
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CorporateCard } from "@/components/corporate/CorporateCard";
import { AnimatedValue } from "@/components/ui/animated-value";
import { TrendBadge } from "@/components/ui/trend-badge";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCashFlow } from "@/hooks/useCashFlow";
import { Link } from "react-router-dom";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-premium rounded-xl p-4 shadow-premium-lg border border-border/50 animate-slide-up-fade">
        <p className="text-sm font-semibold text-foreground mb-3">{label}</p>
        <div className="space-y-2">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full shadow-sm" 
                style={{ 
                  backgroundColor: entry.color,
                  boxShadow: `0 0 8px ${entry.color}40`
                }}
              />
              <span className="text-muted-foreground text-sm">
                {entry.dataKey === "inflow" ? "Entradas" : entry.dataKey === "outflow" ? "Saídas" : "Saldo"}:
              </span>
              <span className={cn(
                "font-bold",
                entry.dataKey === "inflow" ? "text-success" : 
                entry.dataKey === "outflow" ? "text-destructive" : "text-primary"
              )}>
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

function EmptyState() {
  return (
    <Card className="glass-premium border-border/50 shadow-premium-md rounded-2xl overflow-hidden">
      <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-6">
          <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Nenhuma transação encontrada
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          Importe dados de uma planilha ou adicione transações manualmente para visualizar o fluxo de caixa.
        </p>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="gap-2 rounded-xl">
            <Link to="/income">
              <TrendingUp className="w-4 h-4" />
              Adicionar Receita
            </Link>
          </Button>
          <Button asChild className="gap-2 rounded-xl">
            <Link to="/google-sheets">
              <FileSpreadsheet className="w-4 h-4" />
              Importar Planilha
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-10 w-40" />
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <Skeleton className="h-[400px] w-full" />
      </Card>
    </div>
  );
}

export function CashFlowPage() {
  const { cashFlowData, upcomingPayments, totals, isLoading, hasData } = useCashFlow();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!hasData) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
              <ArrowLeftRight className="w-8 h-8 text-primary animate-pulse-glow" />
              Fluxo de Caixa
            </h1>
            <p className="text-muted-foreground mt-1">
              Projeção de entradas e saídas financeiras.
            </p>
          </div>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <ArrowLeftRight className="w-8 h-8 text-primary animate-pulse-glow" />
            Fluxo de Caixa
          </h1>
          <p className="text-muted-foreground mt-1">
            Análise de entradas e saídas financeiras.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="gap-2 rounded-xl bg-primary hover:bg-primary/90 group transition-premium">
            <Link to="/google-sheets">
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              <span>Atualizar Dados</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs de Fluxo de Caixa */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 stagger-children">
        <CorporateCard className="bg-gradient-to-br from-success/8 via-card to-card hover-glow-success">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total de Entradas</p>
              <AnimatedValue
                value={totals.totalInflow}
                prefix="R$ "
                className="text-2xl md:text-3xl tracking-tight"
                color="success"
                glow
                format="currency"
                duration={1800}
              />
            </div>
          </div>
        </CorporateCard>

        <CorporateCard className="bg-gradient-to-br from-destructive/8 via-card to-card hover-glow-danger">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-destructive/10">
              <TrendingDown className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total de Saídas</p>
              <AnimatedValue
                value={totals.totalOutflow}
                prefix="R$ "
                className="text-2xl md:text-3xl tracking-tight"
                color="danger"
                glow
                format="currency"
                duration={1800}
              />
            </div>
          </div>
        </CorporateCard>

        <CorporateCard className="bg-gradient-to-br from-primary/8 via-card to-card hover-glow-primary">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <ArrowLeftRight className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Saldo Líquido</p>
              <AnimatedValue
                value={totals.netCashFlow}
                prefix="R$ "
                className="text-2xl md:text-3xl tracking-tight"
                color={totals.netCashFlow >= 0 ? "primary" : "danger"}
                glow
                format="currency"
                duration={1800}
              />
            </div>
          </div>
        </CorporateCard>
      </div>

      {/* Gráfico de Fluxo de Caixa */}
      <Card className="glass-premium border-border/50 shadow-premium-md rounded-2xl overflow-hidden relative">
        <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Fluxo de Caixa Mensal</CardTitle>
              <CardDescription className="text-muted-foreground">Entradas, saídas e saldo mensal</CardDescription>
            </div>
            <TrendBadge value={totals.trend} size="sm" animated />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="h-[350px] md:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={cashFlowData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorInflowPremium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.4}/>
                    <stop offset="50%" stopColor="hsl(var(--success))" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOutflowPremium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.35}/>
                    <stop offset="50%" stopColor="hsl(var(--destructive))" stopOpacity={0.12}/>
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                  </linearGradient>
                  <filter id="cashflowGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" vertical={false} strokeOpacity={0.5} />
                <XAxis 
                  dataKey="monthLabel" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 500 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 500 }}
                  tickFormatter={formatCurrency}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="inflow"
                  stroke="hsl(var(--success))"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorInflowPremium)"
                  filter="url(#cashflowGlow)"
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: "hsl(var(--success))",
                    stroke: "hsl(var(--background))",
                    strokeWidth: 3,
                    style: { filter: "drop-shadow(0 0 6px hsl(var(--success)))" }
                  }}
                  isAnimationActive={true}
                  animationBegin={0}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="outflow"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorOutflowPremium)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: "hsl(var(--destructive))",
                    stroke: "hsl(var(--background))",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={true}
                  animationBegin={200}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pagamentos Próximos */}
      {upcomingPayments.length > 0 && (
        <Card className="glass-premium border-border/50 shadow-premium-md rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0 gradient-mesh opacity-20 pointer-events-none" />
          <CardHeader className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">Próximos Vencimentos</CardTitle>
                <CardDescription className="text-muted-foreground">Contas a pagar e a receber</CardDescription>
              </div>
              <StatusIndicator status="success" size="sm" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-2 stagger-list">
              {upcomingPayments.map((payment, index) => (
                <div 
                  key={payment.id}
                  className={cn(
                    "flex items-center justify-between py-4 px-4 rounded-xl",
                    "border border-transparent hover:border-border/50",
                    "hover:bg-muted/50 transition-all duration-300 group cursor-pointer"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center",
                        "transition-all duration-300 group-hover:scale-110",
                        payment.type === "income" 
                          ? "bg-success/10 group-hover:bg-success/20" 
                          : "bg-destructive/10 group-hover:bg-destructive/20"
                      )}
                    >
                      {payment.type === "income" ? (
                        <ArrowDownLeft className="w-5 h-5 text-success" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {payment.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vencimento: {formatDate(payment.dueDate)}
                      </p>
                    </div>
                  </div>
                  <span 
                    className={cn(
                      "text-sm font-bold tabular-nums transition-all duration-300 group-hover:scale-105",
                      payment.type === "income" 
                        ? "text-success" 
                        : "text-destructive"
                    )}
                  >
                    {payment.type === "income" ? "+" : "-"}
                    {formatCurrency(Math.abs(payment.amount))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CashFlowPage;
