import { Scale, TrendingUp, TrendingDown, Building, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CorporateCard } from "@/components/corporate/CorporateCard";
import { AnimatedValue } from "@/components/ui/animated-value";
import { cn } from "@/lib/utils";

// Dados de exemplo - Balanço Patrimonial
const assets = {
  current: [
    { name: "Caixa e Equivalentes", value: 253412 },
    { name: "Contas a Receber", value: 189500 },
    { name: "Estoque", value: 124800 },
    { name: "Despesas Antecipadas", value: 18200 },
  ],
  nonCurrent: [
    { name: "Imobilizado", value: 485000 },
    { name: "Intangível", value: 125000 },
    { name: "Investimentos LP", value: 89000 },
  ]
};

const liabilities = {
  current: [
    { name: "Fornecedores", value: 98500 },
    { name: "Empréstimos CP", value: 65000 },
    { name: "Salários a Pagar", value: 42800 },
    { name: "Impostos a Pagar", value: 28900 },
  ],
  nonCurrent: [
    { name: "Empréstimos LP", value: 285000 },
    { name: "Provisões", value: 45000 },
  ]
};

const equity = [
  { name: "Capital Social", value: 500000 },
  { name: "Reservas de Lucros", value: 156712 },
  { name: "Lucros Acumulados", value: 63000 },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
};

const calculateTotal = (items: Array<{ value: number }>) => {
  return items.reduce((acc, item) => acc + item.value, 0);
};

const totalCurrentAssets = calculateTotal(assets.current);
const totalNonCurrentAssets = calculateTotal(assets.nonCurrent);
const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

const totalCurrentLiabilities = calculateTotal(liabilities.current);
const totalNonCurrentLiabilities = calculateTotal(liabilities.nonCurrent);
const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

const totalEquity = calculateTotal(equity);
const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

interface BalanceItemProps {
  name: string;
  value: number;
  isTotal?: boolean;
  colorClass?: string;
  index?: number;
}

function BalanceItem({ name, value, isTotal, colorClass, index = 0 }: BalanceItemProps) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between py-3 px-4 rounded-xl transition-all duration-300",
        isTotal 
          ? "bg-muted/60 font-semibold" 
          : "hover:bg-accent/40 cursor-pointer group"
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <span className={cn(
        "text-sm transition-colors", 
        isTotal ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground"
      )}>
        {name}
      </span>
      <span className={cn(
        "text-sm font-medium tabular-nums transition-all duration-300",
        colorClass || "text-foreground",
        !isTotal && "group-hover:scale-105"
      )}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export function BalanceSheetPage() {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <Scale className="w-8 h-8 text-primary animate-pulse-glow" />
            Balanço Patrimonial
          </h1>
          <p className="text-muted-foreground mt-1">
            Posição patrimonial e financeira da empresa.
          </p>
        </div>
      </div>

      {/* KPIs de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 stagger-children">
        <CorporateCard className="bg-gradient-to-br from-primary/8 via-card to-card hover-glow-primary">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total do Ativo</p>
              <AnimatedValue
                value={totalAssets}
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

        <CorporateCard className="bg-gradient-to-br from-destructive/8 via-card to-card hover-glow-danger">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-destructive/10">
              <TrendingDown className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total do Passivo</p>
              <AnimatedValue
                value={totalLiabilities}
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

        <CorporateCard className="bg-gradient-to-br from-success/8 via-card to-card hover-glow-success">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <Wallet className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Patrimônio Líquido</p>
              <AnimatedValue
                value={totalEquity}
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
      </div>

      {/* Balanço em duas colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna ATIVO */}
        <Card className="glass-premium border-border/50 shadow-premium-md rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0 gradient-mesh opacity-20 pointer-events-none" />
          <CardHeader className="border-b border-border/50 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">ATIVO</CardTitle>
                <CardDescription className="text-muted-foreground">Bens e direitos da empresa</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-5 relative z-10">
            {/* Ativo Circulante */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 px-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                Ativo Circulante
              </h3>
              <div className="space-y-1">
                {assets.current.map((item, index) => (
                  <BalanceItem key={item.name} name={item.name} value={item.value} index={index} />
                ))}
                <BalanceItem name="Subtotal Circulante" value={totalCurrentAssets} isTotal colorClass="text-primary" />
              </div>
            </div>

            {/* Ativo Não Circulante */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 px-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-chart-3" />
                Ativo Não Circulante
              </h3>
              <div className="space-y-1">
                {assets.nonCurrent.map((item, index) => (
                  <BalanceItem key={item.name} name={item.name} value={item.value} index={index} />
                ))}
                <BalanceItem name="Subtotal Não Circulante" value={totalNonCurrentAssets} isTotal colorClass="text-primary" />
              </div>
            </div>

            {/* Total do Ativo */}
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center justify-between py-4 px-4 rounded-xl bg-primary/10">
                <span className="text-sm font-bold text-foreground">TOTAL DO ATIVO</span>
                <span className="text-lg font-bold text-primary tabular-nums">
                  {formatCurrency(totalAssets)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coluna PASSIVO + PL */}
        <Card className="glass-premium border-border/50 shadow-premium-md rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0 gradient-mesh opacity-20 pointer-events-none" />
          <CardHeader className="border-b border-border/50 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/10">
                <Building className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">PASSIVO + PL</CardTitle>
                <CardDescription className="text-muted-foreground">Obrigações e patrimônio</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-5 relative z-10">
            {/* Passivo Circulante */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 px-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                Passivo Circulante
              </h3>
              <div className="space-y-1">
                {liabilities.current.map((item, index) => (
                  <BalanceItem key={item.name} name={item.name} value={item.value} index={index} />
                ))}
                <BalanceItem name="Subtotal Circulante" value={totalCurrentLiabilities} isTotal colorClass="text-destructive" />
              </div>
            </div>

            {/* Passivo Não Circulante */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 px-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-chart-5" />
                Passivo Não Circulante
              </h3>
              <div className="space-y-1">
                {liabilities.nonCurrent.map((item, index) => (
                  <BalanceItem key={item.name} name={item.name} value={item.value} index={index} />
                ))}
                <BalanceItem name="Subtotal Não Circulante" value={totalNonCurrentLiabilities} isTotal colorClass="text-destructive" />
              </div>
            </div>

            {/* Patrimônio Líquido */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 px-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                Patrimônio Líquido
              </h3>
              <div className="space-y-1">
                {equity.map((item, index) => (
                  <BalanceItem key={item.name} name={item.name} value={item.value} index={index} />
                ))}
                <BalanceItem name="Total PL" value={totalEquity} isTotal colorClass="text-success" />
              </div>
            </div>

            {/* Total */}
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center justify-between py-4 px-4 rounded-xl bg-muted/60">
                <span className="text-sm font-bold text-foreground">TOTAL PASSIVO + PL</span>
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {formatCurrency(totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default BalanceSheetPage;
