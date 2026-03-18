import { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TrendingUp, Plus, Filter, Download, DollarSign, ShoppingCart, Briefcase, ArrowDownLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePagination } from "@/hooks/usePerformance";
import { TablePagination } from "@/components/ui/table-pagination";
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
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { KPICard } from "@/components/dashboard/KPICard";
import { TransactionModal } from "@/components/modals/TransactionModal";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { TransactionFormData } from "@/lib/validators";
import { formatCurrencyBR, formatCompactBR } from "@/lib/currency";

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("pt-BR");
};

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function IncomePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const { transactions, isLoading, totals, createTransaction, updateTransaction } = useTransactions({ type: "income", excludeTransfers: true });

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

  const categoryData = useMemo(() => {
    const grouped = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const total = Object.values(grouped).reduce((sum, v) => sum + v, 0);
    return Object.entries(grouped).map(([name, value], i) => ({
      name,
      value: total > 0 ? Math.round((value / total) * 100) : 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [transactions]);

  const monthlyData = useMemo(() => {
    const grouped = transactions.reduce((acc, t) => {
      const month = new Date(t.date).toLocaleString("pt-BR", { month: "short" });
      acc[month] = (acc[month] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([month, receita]) => ({ month, receita }));
  }, [transactions]);

  const avgTransaction = transactions.length > 0 ? totals.income / transactions.length : 0;
  const topCategory = categoryData.length > 0 ? categoryData.sort((a, b) => b.value - a.value)[0]?.name : "-";

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
            <div className="w-10 h-10 rounded-2xl bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            Análise de Receitas
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe e analise todas as suas fontes de receita.
          </p>
        </div>
        <Button className="gap-2 rounded-2xl px-6 shadow-sm" onClick={handleNewTransaction}>
          <Plus className="w-4 h-4" />
          Nova Receita
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="liquid-glass relative overflow-hidden p-0">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-success/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <KPICard
              title="Receita Total"
              value={formatCurrencyBR(totals.income)}
              changeLabel="no período selecionado"
              icon={<DollarSign className="w-5 h-5 text-success" />}
              trend="up"
            />
          </div>
        </div>
        <div className="liquid-glass relative overflow-hidden p-0">
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <KPICard
              title="Ticket Médio"
              value={formatCurrencyBR(avgTransaction)}
              changeLabel={`${transactions.length} transações`}
              icon={<ShoppingCart className="w-5 h-5 text-primary" />}
              trend="neutral"
            />
          </div>
        </div>
        <div className="liquid-glass relative overflow-hidden p-0">
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-info/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <KPICard
              title="Maior Fonte"
              value={topCategory}
              changeLabel="categoria principal"
              icon={<Briefcase className="w-5 h-5 text-info" />}
              trend="neutral"
            />
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receita Mensal */}
        <div className="liquid-glass-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">Receita Mensal</h3>
            <p className="text-sm text-muted-foreground">Evolução da receita ao longo do tempo</p>
          </div>
          <div className="h-[280px]">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <defs>
                    <linearGradient id="incomeBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.5} />
                    </linearGradient>
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
                            <p className="text-sm font-medium text-foreground">{label}</p>
                            <p className="text-lg font-semibold text-success">
                              {formatCurrencyBR(payload[0].value as number)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="receita" fill="url(#incomeBarGradient)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Distribuição por Categoria */}
        <div className="liquid-glass-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">Receita por Categoria</h3>
            <p className="text-sm text-muted-foreground">Distribuição das fontes de receita</p>
          </div>
          <div className="h-[280px]">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="liquid-glass-tooltip">
                            <p className="text-sm font-medium text-foreground">{data.name}</p>
                            <p className="text-lg font-semibold text-foreground">{data.value}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-3">
            {categoryData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/40 backdrop-blur-sm">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-xs font-medium text-foreground/80">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de Transações */}
      <div className="liquid-glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">Transações de Receita</h3>
            <p className="text-sm text-muted-foreground">Todas as entradas financeiras registradas</p>
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
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className="hover:bg-white/40 transition-all duration-200 cursor-pointer border-b border-border/20"
                    onClick={() => handleEdit(item)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-success/10 backdrop-blur-sm flex items-center justify-center">
                          <ArrowDownLeft className="w-4 h-4 text-success" />
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
                    <TableCell className="text-right font-semibold text-success">
                      +{formatCurrencyBR(Number(item.amount))}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {transactions.length === 0 
                      ? "Nenhuma receita cadastrada. Clique em 'Nova Receita' para começar."
                      : "Nenhum resultado encontrado para a busca."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          startIndex={startIndex}
          endIndex={endIndex}
          hasPrevPage={hasPrevPage}
          hasNextPage={hasNextPage}
          onPrevPage={prevPage}
          onNextPage={nextPage}
          onGoToPage={goToPage}
        />
      </div>

      <TransactionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
        defaultType="income"
        transaction={editingTransaction}
      />
    </div>
  );
}

export default IncomePage;
