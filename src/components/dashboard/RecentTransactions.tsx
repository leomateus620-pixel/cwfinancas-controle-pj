import { ArrowUpRight, ArrowDownLeft, Loader2, FileQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/useTransactions";

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
  const { transactions, isLoading } = useTransactions();

  // Pegar as últimas 5 transações
  const recentTransactions = transactions.slice(0, 5);

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
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : recentTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileQuestion className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma transação encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">Importe dados ou adicione transações manualmente</p>
          </div>
        ) : (
          <div className="space-y-2 stagger-list">
            {recentTransactions.map((transaction, index) => (
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
                  {formatCurrency(Number(transaction.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
