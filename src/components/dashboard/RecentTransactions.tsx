import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { cn } from "@/lib/utils";

// Dados de exemplo - serão substituídos por dados reais
const transactions = [
  {
    id: 1,
    description: "Licença de Software Empresarial",
    category: "Vendas de Produtos",
    amount: 24500,
    type: "income",
    date: "2024-01-15",
  },
  {
    id: 2,
    description: "Serviços de Nuvem AWS",
    category: "Tecnologia",
    amount: -8420,
    type: "expense",
    date: "2024-01-14",
  },
  {
    id: 3,
    description: "Consultoria de TI",
    category: "Serviços",
    amount: 15000,
    type: "income",
    date: "2024-01-13",
  },
  {
    id: 4,
    description: "Campanha de Marketing",
    category: "Marketing",
    amount: -12800,
    type: "expense",
    date: "2024-01-12",
  },
  {
    id: 5,
    description: "Receita de Assinaturas SaaS",
    category: "Assinaturas",
    amount: 8900,
    type: "income",
    date: "2024-01-11",
  },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    month: "short",
    day: "numeric",
  });
};

export function RecentTransactions() {
  return (
    <Card className="glass-premium border-border/50 shadow-premium-md hover:shadow-premium-lg transition-premium animate-corporate-enter rounded-2xl overflow-hidden relative">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 gradient-mesh opacity-20 pointer-events-none" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Transações Recentes</CardTitle>
            <CardDescription className="text-muted-foreground">Últimas movimentações financeiras</CardDescription>
          </div>
          <StatusIndicator status="success" size="sm" />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="space-y-2 stagger-list">
          {transactions.map((transaction, index) => (
            <div 
              key={transaction.id}
              className={cn(
                "flex items-center justify-between py-4 px-4 -mx-2 rounded-xl",
                "border border-transparent hover:border-border/50",
                "hover:bg-muted/50 transition-all duration-300",
                "cursor-pointer group"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-4">
                <div 
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center",
                    "transition-all duration-300 group-hover:scale-110",
                    transaction.type === "income" 
                      ? "bg-success/10 group-hover:bg-success/20" 
                      : "bg-destructive/10 group-hover:bg-destructive/20"
                  )}
                  style={{
                    boxShadow: transaction.type === "income" 
                      ? '0 0 0 0 hsl(var(--success) / 0)' 
                      : '0 0 0 0 hsl(var(--destructive) / 0)'
                  }}
                >
                  {transaction.type === "income" ? (
                    <ArrowDownLeft className="w-5 h-5 text-success" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.5 bg-muted/50 rounded-full">{transaction.category}</span>
                    <span>•</span>
                    <span>{formatDate(transaction.date)}</span>
                  </p>
                </div>
              </div>
              <span 
                className={cn(
                  "text-sm font-bold tabular-nums transition-all duration-300",
                  "group-hover:scale-105",
                  transaction.type === "income" 
                    ? "text-success" 
                    : "text-destructive"
                )}
              >
                {transaction.type === "income" ? "+" : "-"}
                {formatCurrency(transaction.amount)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
