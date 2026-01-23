import { Scale, TrendingUp, TrendingDown, Building, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CorporateCard } from "@/components/corporate/CorporateCard";
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
}

function BalanceItem({ name, value, isTotal, colorClass }: BalanceItemProps) {
  return (
    <div className={cn(
      "flex items-center justify-between py-2.5 px-3 rounded-lg",
      isTotal ? "bg-muted/50 font-semibold" : "hover:bg-accent/30 transition-corporate"
    )}>
      <span className={cn("text-sm", isTotal ? "text-foreground" : "text-muted-foreground")}>
        {name}
      </span>
      <span className={cn("text-sm font-medium", colorClass || "text-foreground")}>
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
            <Scale className="w-8 h-8 text-primary" />
            Balanço Patrimonial
          </h1>
          <p className="text-muted-foreground mt-1">
            Posição patrimonial e financeira da empresa.
          </p>
        </div>
      </div>

      {/* KPIs de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 stagger-children">
        <CorporateCard className="bg-gradient-to-br from-primary/5 via-card to-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total do Ativo</p>
              <p className="text-2xl md:text-3xl font-bold text-primary tracking-tight">
                {formatCurrency(totalAssets)}
              </p>
            </div>
          </div>
        </CorporateCard>

        <CorporateCard className="bg-gradient-to-br from-destructive/5 via-card to-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-destructive/10">
              <TrendingDown className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total do Passivo</p>
              <p className="text-2xl md:text-3xl font-bold text-destructive tracking-tight">
                {formatCurrency(totalLiabilities)}
              </p>
            </div>
          </div>
        </CorporateCard>

        <CorporateCard className="bg-gradient-to-br from-success/5 via-card to-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <Wallet className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Patrimônio Líquido</p>
              <p className="text-2xl md:text-3xl font-bold text-success tracking-tight">
                {formatCurrency(totalEquity)}
              </p>
            </div>
          </div>
        </CorporateCard>
      </div>

      {/* Balanço em duas colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna ATIVO */}
        <Card className="bg-card/95 backdrop-blur-md border-border shadow-corporate-md rounded-2xl">
          <CardHeader className="border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">ATIVO</CardTitle>
                <CardDescription className="text-muted-foreground">Bens e direitos da empresa</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Ativo Circulante */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 px-3">Ativo Circulante</h3>
              <div className="space-y-1">
                {assets.current.map((item) => (
                  <BalanceItem key={item.name} name={item.name} value={item.value} />
                ))}
                <BalanceItem name="Subtotal Circulante" value={totalCurrentAssets} isTotal colorClass="text-primary" />
              </div>
            </div>

            {/* Ativo Não Circulante */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 px-3">Ativo Não Circulante</h3>
              <div className="space-y-1">
                {assets.nonCurrent.map((item) => (
                  <BalanceItem key={item.name} name={item.name} value={item.value} />
                ))}
                <BalanceItem name="Subtotal Não Circulante" value={totalNonCurrentAssets} isTotal colorClass="text-primary" />
              </div>
            </div>

            {/* Total do Ativo */}
            <div className="pt-4 border-t border-border">
              <BalanceItem name="TOTAL DO ATIVO" value={totalAssets} isTotal colorClass="text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* Coluna PASSIVO + PL */}
        <Card className="bg-card/95 backdrop-blur-md border-border shadow-corporate-md rounded-2xl">
          <CardHeader className="border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Building className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">PASSIVO + PL</CardTitle>
                <CardDescription className="text-muted-foreground">Obrigações e patrimônio</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Passivo Circulante */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 px-3">Passivo Circulante</h3>
              <div className="space-y-1">
                {liabilities.current.map((item) => (
                  <BalanceItem key={item.name} name={item.name} value={item.value} />
                ))}
                <BalanceItem name="Subtotal Circulante" value={totalCurrentLiabilities} isTotal colorClass="text-destructive" />
              </div>
            </div>

            {/* Passivo Não Circulante */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 px-3">Passivo Não Circulante</h3>
              <div className="space-y-1">
                {liabilities.nonCurrent.map((item) => (
                  <BalanceItem key={item.name} name={item.name} value={item.value} />
                ))}
                <BalanceItem name="Subtotal Não Circulante" value={totalNonCurrentLiabilities} isTotal colorClass="text-destructive" />
              </div>
            </div>

            {/* Patrimônio Líquido */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 px-3">Patrimônio Líquido</h3>
              <div className="space-y-1">
                {equity.map((item) => (
                  <BalanceItem key={item.name} name={item.name} value={item.value} />
                ))}
                <BalanceItem name="Total PL" value={totalEquity} isTotal colorClass="text-success" />
              </div>
            </div>

            {/* Total */}
            <div className="pt-4 border-t border-border">
              <BalanceItem name="TOTAL PASSIVO + PL" value={totalLiabilitiesAndEquity} isTotal colorClass="text-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default BalanceSheetPage;
