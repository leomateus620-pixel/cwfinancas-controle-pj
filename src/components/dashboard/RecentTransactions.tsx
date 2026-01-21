import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Sample data - will be replaced with real data
const transactions = [
  {
    id: 1,
    description: "Enterprise Software License",
    category: "Product Sales",
    amount: 24500,
    type: "income",
    date: "2024-01-15",
  },
  {
    id: 2,
    description: "AWS Cloud Services",
    category: "Technology",
    amount: -8420,
    type: "expense",
    date: "2024-01-14",
  },
  {
    id: 3,
    description: "Consulting Services",
    category: "Services",
    amount: 15000,
    type: "income",
    date: "2024-01-13",
  },
  {
    id: 4,
    description: "Marketing Campaign",
    category: "Marketing",
    amount: -12800,
    type: "expense",
    date: "2024-01-12",
  },
  {
    id: 5,
    description: "SaaS Subscription Revenue",
    category: "Subscriptions",
    amount: 8900,
    type: "income",
    date: "2024-01-11",
  },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export function RecentTransactions() {
  return (
    <Card className="shadow-premium-sm hover:shadow-premium-md transition-premium animate-fade-in border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
        <CardDescription>Latest financial activity</CardDescription>
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
