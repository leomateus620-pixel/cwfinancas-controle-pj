import { ArrowUpRight, ArrowDownLeft, Loader2, FileQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

  const recentTransactions = transactions.slice(0, 5);

  return (
    <Card className="border-border shadow-corporate-sm hover:shadow-corporate-md transition-corporate rounded-xl overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">Transações Recentes</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Últimas movimentações</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-56">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : recentTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-center">
            <FileQuestion className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma transação encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">Importe dados ou adicione transações</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentTransactions.map((transaction) => (
              <div 
                key={transaction.id}
                className={cn(
                  "flex items-center justify-between py-3 px-3 -mx-1 rounded-lg",
                  "hover:bg-muted/50 transition-colors cursor-pointer group"
                )}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center",
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
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{transaction.category}</span>
                      <span>•</span>
                      <span>{formatDate(transaction.date)}</span>
                    </p>
                  </div>
                </div>
                <span 
                  className={cn(
                    "text-sm font-semibold tabular-nums",
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
