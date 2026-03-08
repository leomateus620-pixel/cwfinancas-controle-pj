import { ArrowUpRight, ArrowDownLeft, Loader2, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrencyBR } from "@/lib/currency";

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
    <div className="liquid-glass-card p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Transações Recentes</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Últimas movimentações</p>
      </div>
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
                "flex items-center justify-between py-3 px-3 -mx-1 rounded-xl",
                "hover:bg-white/40 transition-all duration-200 cursor-pointer group"
              )}
            >
              <div className="flex items-center gap-3">
                <div 
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center ring-1",
                    transaction.type === "income" 
                      ? "bg-success/8 ring-success/10" 
                      : "bg-destructive/8 ring-destructive/10"
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
                    <span className="px-1.5 py-0.5 bg-muted/40 rounded-md text-[10px] font-medium">{transaction.category}</span>
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
                {formatCurrencyBR(Math.abs(Number(transaction.amount)))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
