import { useState, useMemo } from "react";
import { TrendingDown, Plus, Filter, Download, CreditCard, Building2, ArrowUpRight, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from "recharts";
import { KPICard } from "@/components/dashboard/KPICard";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { TransactionModal } from "@/components/modals/TransactionModal";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { TransactionFormData } from "@/lib/validators";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("pt-BR");
};

export function ExpensesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const { transactions, isLoading, totals, createTransaction, updateTransaction } = useTransactions({ type: "expense", excludeTransfers: true });

  const filteredData = useMemo(() => {
    return transactions.filter((item) => {
      const matchesSearch = 
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.client_vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [transactions, searchTerm, categoryFilter]);

  const categories = useMemo(() => {
    const cats = [...new Set(transactions.map(t => t.category))];
    return cats;
  }, [transactions]);

  const categoryBreakdown = useMemo(() => {
    const grouped = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const maxBudget = Math.max(...Object.values(grouped), 1) * 1.2;
    
    return Object.entries(grouped).map(([category, amount], i) => ({
      category,
      amount,
      budget: maxBudget,
      color: `hsl(var(--chart-${(i % 5) + 1}))`,
    }));
  }, [transactions]);

  const monthlyData = useMemo(() => {
    const grouped = transactions.reduce((acc, t) => {
      const month = new Date(t.date).toLocaleString("pt-BR", { month: "short" });
      acc[month] = (acc[month] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([month, despesas]) => ({ month, despesas }));
  }, [transactions]);

  const budgetTotal = totals.expense * 1.2;
  const budgetUsed = budgetTotal > 0 ? (totals.expense / budgetTotal) * 100 : 0;
  const topCategory = categoryBreakdown.length > 0 
    ? categoryBreakdown.sort((a, b) => b.amount - a.amount)[0]?.category 
    : "-";

  const handleSubmit = async (data: TransactionFormData) => {
    if (editingTransaction) {
      await updateTransaction.mutateAsync({ 
        id: editingTransaction.id, 
        type: data.type,
        description: data.description,
        amount: data.amount,
        category: data.category,
        date: data.date,
        client_vendor: data.client_vendor,
        notes: data.notes,
      });
    } else {
      await createTransaction.mutateAsync({
        type: data.type,
        description: data.description,
        amount: data.amount,
        category: data.category,
        date: data.date,
        client_vendor: data.client_vendor || null,
        notes: data.notes || null,
      });
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setModalOpen(true);
  };

  const handleNewTransaction = () => {
    setEditingTransaction(null);
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
            <TrendingDown className="w-7 h-7 text-destructive" />
            Controle de Despesas
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitore e categorize todos os seus gastos.
          </p>
        </div>
        <Button className="gap-2" onClick={handleNewTransaction}>
          <Plus className="w-4 h-4" />
          Nova Despesa
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Total de Despesas"
          value={formatCurrency(totals.expense)}
          changeLabel="no período selecionado"
          icon={<CreditCard className="w-5 h-5 text-destructive" />}
          trend="down"
        />
        <KPICard
          title="Maior Categoria"
          value={topCategory}
          changeLabel="categoria principal"
          icon={<Building2 className="w-5 h-5 text-primary" />}
          trend="neutral"
        />
        <KPICard
          title="Orçamento Usado"
          value={`${budgetUsed.toFixed(1)}%`}
          change={budgetUsed > 100 ? budgetUsed - 100 : 100 - budgetUsed}
          changeLabel={budgetUsed > 100 ? "acima do orçamento" : "dentro do orçamento"}
          icon={<AlertTriangle className="w-5 h-5 text-warning" />}
          trend={budgetUsed > 100 ? "down" : "up"}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Despesas Mensais */}
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <CardTitle className="text-lg">Despesas Mensais</CardTitle>
            <CardDescription>Evolução das despesas ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border border-border rounded-lg p-3 shadow-premium-lg">
                              <p className="text-sm font-medium text-foreground mb-2">{label}</p>
                              <p className="text-sm text-destructive">
                                Despesas: {formatCurrency(payload[0].value as number)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="despesas" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--destructive))", strokeWidth: 0, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gastos por Categoria */}
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <CardTitle className="text-lg">Gastos por Categoria</CardTitle>
            <CardDescription>Distribuição por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryBreakdown.length > 0 ? (
                categoryBreakdown.slice(0, 5).map((item, index) => {
                  const percentage = (item.amount / item.budget) * 100;
                  const isOverBudget = percentage > 100;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{item.category}</span>
                        <span className={cn(
                          "font-medium",
                          isOverBudget ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                      <div className="relative">
                        <Progress 
                          value={Math.min(percentage, 100)} 
                          className={cn(
                            "h-2",
                            isOverBudget && "[&>div]:bg-destructive"
                          )}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Transações */}
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Transações de Despesas</CardTitle>
              <CardDescription>Todas as saídas financeiras registradas</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-[200px]"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map((item) => (
                    <TableRow 
                      key={item.id} 
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => handleEdit(item)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <ArrowUpRight className="w-4 h-4 text-destructive" />
                          </div>
                          <span className="font-medium">{item.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
                          {item.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.client_vendor || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(item.date)}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        -{formatCurrency(Number(item.amount))}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {transactions.length === 0 
                        ? "Nenhuma despesa cadastrada. Clique em 'Nova Despesa' para começar."
                        : "Nenhum resultado encontrado para a busca."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TransactionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
        defaultType="expense"
        transaction={editingTransaction}
      />
    </div>
  );
}

export default ExpensesPage;
