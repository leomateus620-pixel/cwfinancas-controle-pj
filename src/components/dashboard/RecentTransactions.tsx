import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    <Card className="shadow-premium-sm hover:shadow-premium-md transition-premium animate-fade-in border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Transações Recentes</CardTitle>
        <CardDescription>Últimas movimentações financeiras</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <div 
              key={transaction.id}
              className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div 
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    transaction.type === "income" 
                      ? "bg-success/10" 
                      : "bg-destructive/10"
                  )}
                >
                  {transaction.type === "income" ? (
                    <ArrowDownLeft className="w-4 h-4 text-success" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {transaction.category} • {formatDate(transaction.date)}
                  </p>
                </div>
              </div>
              <span 
                className={cn(
                  "text-sm font-semibold",
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
