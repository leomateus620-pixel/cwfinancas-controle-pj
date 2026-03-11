import { useState, useMemo, useEffect } from "react";
import { TrendingDown, Plus, Filter, Download, CreditCard, Building2, ArrowUpRight, Loader2 } from "lucide-react";
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
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { KPICard } from "@/components/dashboard/KPICard";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { TransactionModal } from "@/components/modals/TransactionModal";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { TransactionFormData } from "@/lib/validators";
import { formatCurrencyBR, formatCompactBR } from "@/lib/currency";
import { usePagination } from "@/hooks/usePerformance";
import { TablePagination } from "@/components/ui/table-pagination";

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("pt-BR");
};

export function ExpensesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const { transactions, isLoading, totals, createTransaction, updateTransaction } = useTransactions({ type: "expense", excludeTransfers: true });

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredData = useMemo(() => {
    return transactions.filter((item) => {
      const matchesSearch = 
        item.description.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (item.client_vendor?.toLowerCase().includes(debouncedSearch.toLowerCase()) ?? false);
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [transactions, debouncedSearch, categoryFilter]);

  const {
    paginatedItems,
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    goToPage,
  } = usePagination(filteredData, 50);

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
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-destructive" />
            </div>
            Controle de Despesas
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitore e categorize todos os seus gastos.
          </p>
        </div>
        <Button className="gap-2 rounded-2xl px-6 shadow-sm" onClick={handleNewTransaction}>
          <Plus className="w-4 h-4" />
          Nova Despesa
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="liquid-glass relative overflow-hidden p-0">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-destructive/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <KPICard
              title="Total de Despesas"
              value={formatCurrencyBR(totals.expense)}
              changeLabel="no período selecionado"
              icon={<CreditCard className="w-5 h-5 text-destructive" />}
              trend="down"
            />
          </div>
        </div>
        <div className="liquid-glass relative overflow-hidden p-0">
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <KPICard
              title="Maior Categoria"
              value={topCategory}
              changeLabel="categoria principal"
              icon={<Building2 className="w-5 h-5 text-primary" />}
              trend="neutral"
            />
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Despesas Mensais */}
        <div className="liquid-glass-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">Despesas Mensais</h3>
            <p className="text-sm text-muted-foreground">Evolução das despesas ao longo do tempo</p>
          </div>
          <div className="h-[280px]">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData}>
                  <defs>
                    <linearGradient id="expenseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.01} />
                    </linearGradient>
                    <filter id="expenseLineGlow">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" vertical={false} />
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
                    tickFormatter={(value) => formatCompactBR(value)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="liquid-glass-tooltip">
                            <p className="text-sm font-medium text-foreground mb-1">{label}</p>
                            <p className="text-lg font-semibold text-destructive">
                              {formatCurrencyBR(payload[0].value as number)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="despesas"
                    fill="url(#expenseAreaGradient)"
                    stroke="none"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="despesas" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2.5}
                    dot={{ fill: "hsl(var(--destructive))", strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: "hsl(var(--destructive))", stroke: "white", strokeWidth: 2 }}
                    filter="url(#expenseLineGlow)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Gastos por Categoria */}
        <div className="liquid-glass-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">Gastos por Categoria</h3>
            <p className="text-sm text-muted-foreground">Distribuição por categoria</p>
          </div>
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
                        "font-semibold",
                        isOverBudget ? "text-destructive" : "text-foreground/70"
                      )}>
                        {formatCurrencyBR(item.amount)}
                      </span>
                    </div>
                    <div className="relative">
                      <Progress 
                        value={Math.min(percentage, 100)} 
                        className={cn(
                          "h-2.5 rounded-full bg-secondary/30",
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
        </div>
      </div>

      {/* Tabela de Transações */}
      <div className="liquid-glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">Transações de Despesas</h3>
            <p className="text-sm text-muted-foreground">Todas as saídas financeiras registradas</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[200px] rounded-xl border-border/40 bg-white/50 backdrop-blur-sm"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] rounded-xl border-border/40 bg-white/50 backdrop-blur-sm">
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
            <Button variant="outline" size="icon" className="rounded-xl border-border/40 bg-white/50 backdrop-blur-sm">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="rounded-2xl border border-border/30 overflow-hidden bg-white/20">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 border-b border-border/30">
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Conta/Banco</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className="hover:bg-white/40 transition-all duration-200 cursor-pointer border-b border-border/20"
                    onClick={() => handleEdit(item)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-destructive/10 backdrop-blur-sm flex items-center justify-center">
                          <ArrowUpRight className="w-4 h-4 text-destructive" />
                        </div>
                        <span className="font-medium">{item.description}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/50 text-secondary-foreground backdrop-blur-sm">
                        {item.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.client_vendor || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(item.date)}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      -{formatCurrencyBR(Number(item.amount))}
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
      </div>

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
