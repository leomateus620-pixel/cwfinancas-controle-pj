import { 
  ArrowLeftRight, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw
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
import { cn } from "@/lib/utils";

// Dados de exemplo - fluxo de caixa projetado
const cashFlowData = [
  { month: "Jan", inflow: 245000, outflow: 180000, balance: 65000 },
  { month: "Fev", inflow: 312000, outflow: 195000, balance: 117000 },
  { month: "Mar", inflow: 287000, outflow: 210000, balance: 77000 },
  { month: "Abr", inflow: 356000, outflow: 198000, balance: 158000 },
  { month: "Mai", inflow: 398000, outflow: 225000, balance: 173000 },
  { month: "Jun", inflow: 425000, outflow: 240000, balance: 185000 },
  { month: "Jul", inflow: 378000, outflow: 218000, balance: 160000 },
  { month: "Ago", inflow: 445000, outflow: 255000, balance: 190000 },
  { month: "Set", inflow: 412000, outflow: 235000, balance: 177000 },
  { month: "Out", inflow: 489000, outflow: 268000, balance: 221000 },
  { month: "Nov", inflow: 523000, outflow: 285000, balance: 238000 },
  { month: "Dez", inflow: 567000, outflow: 310000, balance: 257000 },
];

const upcomingPayments = [
  { id: 1, description: "Folha de Pagamento", amount: -185000, dueDate: "2024-01-25", type: "expense" },
  { id: 2, description: "Fornecedor ABC", amount: -42000, dueDate: "2024-01-28", type: "expense" },
  { id: 3, description: "Recebimento Cliente XYZ", amount: 89000, dueDate: "2024-01-30", type: "income" },
  { id: 4, description: "Impostos Federais", amount: -28000, dueDate: "2024-02-05", type: "expense" },
  { id: 5, description: "Assinaturas Mensais", amount: 156000, dueDate: "2024-02-10", type: "income" },
];

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

export function CashFlowPage() {
  const totalInflow = cashFlowData.reduce((acc, curr) => acc + curr.inflow, 0);
  const totalOutflow = cashFlowData.reduce((acc, curr) => acc + curr.outflow, 0);
  const netCashFlow = totalInflow - totalOutflow;

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
            Projeção de entradas e saídas financeiras.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 rounded-xl border-border group transition-premium">
            <Calendar className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Próximos 12 meses</span>
          </Button>
          <Button className="gap-2 rounded-xl bg-primary hover:bg-primary/90 group transition-premium">
            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            <span>Atualizar Projeção</span>
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
                value={totalInflow}
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
                value={totalOutflow}
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
              <p className="text-sm text-muted-foreground font-medium">Saldo Projetado</p>
              <AnimatedValue
                value={netCashFlow}
                prefix="R$ "
                className="text-2xl md:text-3xl tracking-tight"
                color="primary"
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
              <CardTitle className="text-lg font-semibold text-foreground">Projeção de Fluxo de Caixa</CardTitle>
              <CardDescription className="text-muted-foreground">Entradas, saídas e saldo mensal projetado</CardDescription>
            </div>
            <TrendBadge value={15.2} size="sm" animated />
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
                  dataKey="month" 
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
    </div>
  );
}

export default CashFlowPage;
