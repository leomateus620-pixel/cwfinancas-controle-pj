import { useState, useMemo, useEffect, useCallback } from "react";
import {
  TrendingDown, Plus, Filter, Download, CreditCard, Building2,
  ArrowUpRight, Loader2, Receipt, Calculator, Lightbulb,
  ChevronDown, ChevronUp, BarChart3, Target, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, PieChart, Pie, Cell, Sector,
} from "recharts";
import { KPICard } from "@/components/dashboard/KPICard";
import { cn } from "@/lib/utils";
import { TransactionModal } from "@/components/modals/TransactionModal";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { TransactionFormData } from "@/lib/validators";
import { formatCurrencyBR, formatCompactBR } from "@/lib/currency";
import { usePagination } from "@/hooks/usePerformance";
import { TablePagination } from "@/components/ui/table-pagination";

const CHART_COLORS = [
  "hsl(0 84% 60%)",       // red
  "hsl(221 75% 65%)",     // blue
  "hsl(142 60% 50%)",     // green
  "hsl(38 92% 55%)",      // amber
  "hsl(262 70% 60%)",     // purple
  "hsl(190 80% 45%)",     // cyan
  "hsl(328 70% 55%)",     // pink
  "hsl(45 90% 50%)",      // yellow
  "hsl(160 60% 45%)",     // teal
  "hsl(15 80% 55%)",      // orange
  "hsl(270 50% 50%)",     // indigo
  "hsl(200 70% 55%)",     // sky
  "hsl(100 55% 45%)",     // lime
  "hsl(350 60% 45%)",     // rose
  "hsl(180 50% 40%)",     // dark teal
];

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("pt-BR");

const isValidCategory = (cat: string | null | undefined): cat is string =>
  !!cat && cat.trim() !== "" && cat.toLowerCase() !== "sem categoria";

export function ExpensesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const { transactions, isLoading, totals, createTransaction, updateTransaction } = useTransactions({ type: "expense" });

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
    paginatedItems, currentPage, totalPages, totalItems,
    startIndex, endIndex, hasNextPage, hasPrevPage,
    nextPage, prevPage, goToPage,
  } = usePagination(filteredData, 50);

  const categories = useMemo(() => {
    return [...new Set(transactions.map(t => t.category))];
  }, [transactions]);

  const categoryBreakdown = useMemo(() => {
    const grouped = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([category, amount]) => ({ category, amount }));
  }, [transactions]);

  const validCategoryBreakdown = useMemo(() => {
    return categoryBreakdown
      .filter(item => isValidCategory(item.category))
      .sort((a, b) => b.amount - a.amount);
  }, [categoryBreakdown]);

  const totalValidCategories = useMemo(() =>
    validCategoryBreakdown.reduce((s, c) => s + c.amount, 0),
    [validCategoryBreakdown]
  );

  const pieData = useMemo(() =>
    validCategoryBreakdown.map((item, i) => ({
      ...item,
      color: CHART_COLORS[i % CHART_COLORS.length],
      percent: totalValidCategories > 0
        ? ((item.amount / totalValidCategories) * 100).toFixed(1)
        : "0",
    })),
    [validCategoryBreakdown, totalValidCategories]
  );

  const topCategoryData = validCategoryBreakdown[0];
  const topPercent = topCategoryData && totals.expense > 0
    ? ((topCategoryData.amount / totals.expense) * 100).toFixed(0) : "0";
  const avgExpense = transactions.length > 0 ? totals.expense / transactions.length : 0;

  const top5Transactions = useMemo(() =>
    [...transactions].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5),
    [transactions]
  );

  const monthlyData = useMemo(() => {
    const grouped = transactions.reduce((acc, t) => {
      const month = new Date(t.date).toLocaleString("pt-BR", { month: "short" });
      acc[month] = (acc[month] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([month, despesas]) => ({ month, despesas }));
  }, [transactions]);

  const handleSubmit = async (data: TransactionFormData) => {
    if (editingTransaction) {
      await updateTransaction.mutateAsync({
        id: editingTransaction.id,
        type: data.type, description: data.description, amount: data.amount,
        category: data.category, date: data.date,
        client_vendor: data.client_vendor, notes: data.notes,
      });
    } else {
      await createTransaction.mutateAsync({
        type: data.type, description: data.description, amount: data.amount,
        category: data.category, date: data.date,
        client_vendor: data.client_vendor || null, notes: data.notes || null,
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
      {/* ═══ HEADER ANALÍTICO ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-destructive" />
            </div>
            Controle de Despesas
          </h1>
          <p className="text-muted-foreground mt-1">
            {transactions.length > 0
              ? `${transactions.length} lançamentos registrados no período`
              : "Monitore e categorize todos os seus gastos."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 rounded-2xl border-border/40 bg-white/50 backdrop-blur-sm">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
          <Button className="gap-2 rounded-2xl px-6 shadow-sm" onClick={handleNewTransaction}>
            <Plus className="w-4 h-4" />
            Nova Despesa
          </Button>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {/* Total de Despesas */}
        <div className="liquid-glass relative overflow-hidden p-0 animate-fade-in">
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

        {/* Quantidade de Lançamentos */}
        <div className="liquid-glass relative overflow-hidden p-0 animate-fade-in" style={{ animationDelay: "50ms" }}>
          <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <KPICard
              title="Lançamentos"
              value={String(transactions.length)}
              changeLabel="transações no período"
              icon={<Receipt className="w-5 h-5 text-primary" />}
              trend="neutral"
            />
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="liquid-glass relative overflow-hidden p-0 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <div className="absolute -top-10 -left-10 w-28 h-28 bg-warning/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <KPICard
              title="Ticket Médio"
              value={formatCurrencyBR(avgExpense)}
              changeLabel="por transação"
              icon={<Calculator className="w-5 h-5 text-warning" />}
              trend="neutral"
            />
          </div>
        </div>

        {/* Maior Categoria */}
        <div className="liquid-glass relative overflow-hidden p-0 animate-fade-in" style={{ animationDelay: "150ms" }}>
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-info/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <KPICard
              title="Maior Categoria"
              value={topCategoryData?.category ?? "-"}
              changeLabel={topCategoryData ? `${topPercent}% do total` : "sem dados"}
              icon={<Building2 className="w-5 h-5 text-info" />}
              trend="neutral"
            />
          </div>
        </div>
      </div>

      {/* ═══ INSIGHT BANNER ═══ */}
      {topCategoryData && (
        <div className="liquid-glass p-4 flex items-start gap-3 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0 mt-0.5">
            <Lightbulb className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Sua maior concentração de despesas está em{" "}
              <span className="font-semibold text-destructive">{topCategoryData.category}</span>,
              representando <span className="font-semibold">{topPercent}%</span> do total.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCurrencyBR(topCategoryData.amount)} de {formatCurrencyBR(totals.expense)} em despesas
            </p>
          </div>
        </div>
      )}

      {/* ═══ GRÁFICOS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Despesas Mensais */}
        <div className="liquid-glass-card p-6 animate-fade-in" style={{ animationDelay: "250ms" }}>
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
                  <XAxis dataKey="month" axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickFormatter={(v) => formatCompactBR(v)} />
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
                  <Area type="monotone" dataKey="despesas" fill="url(#expenseAreaGradient)"
                    stroke="none" animationDuration={800} />
                  <Line type="monotone" dataKey="despesas"
                    stroke="hsl(var(--destructive))" strokeWidth={2.5}
                    dot={{ fill: "hsl(var(--destructive))", strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: "hsl(var(--destructive))", stroke: "white", strokeWidth: 2 }}
                    filter="url(#expenseLineGlow)" animationDuration={800} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Categorias - PieChart */}
        <div className="liquid-glass-card p-6 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">Categorias de Despesas</h3>
            <p className="text-sm text-muted-foreground">Distribuição por categoria</p>
          </div>
          {pieData.length > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <div className="h-[220px] w-full max-w-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      animationDuration={800}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="liquid-glass-tooltip">
                              <p className="text-sm font-medium text-foreground mb-1">{d.category}</p>
                              <p className="text-base font-semibold text-destructive">{formatCurrencyBR(d.amount)}</p>
                              <p className="text-xs text-muted-foreground">{d.percent}% do total</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legenda */}
              <div className="w-full space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="font-medium text-foreground/80 truncate">{entry.category}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">{entry.percent}%</span>
                      <span className="font-semibold text-foreground/90 tabular-nums">{formatCurrencyBR(entry.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </div>
      </div>

      {/* ═══ TOP 5 MAIORES GASTOS ═══ */}
      {top5Transactions.length > 0 && (
        <div className="animate-fade-in" style={{ animationDelay: "350ms" }}>
          <h3 className="text-base font-semibold text-foreground mb-3">Top 5 Maiores Gastos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {top5Transactions.map((t, i) => (
              <div
                key={t.id}
                className="liquid-glass p-4 cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                style={{ animationDelay: `${400 + i * 50}ms` }}
                onClick={() => handleEdit(t)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive">
                    {i + 1}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary/50 text-secondary-foreground truncate">
                    {t.category}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground truncate mb-1">{t.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                  <span className="text-sm font-semibold text-destructive tabular-nums">
                    -{formatCurrencyBR(Number(t.amount))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ LISTA DE TRANSAÇÕES (RECOLHÍVEL) ═══ */}
      <div className="liquid-glass-card p-6">
        <button
          type="button"
          onClick={() => setListOpen(!listOpen)}
          className="w-full flex items-center justify-between gap-4 mb-2 cursor-pointer group"
        >
          <div>
            <h3 className="text-base font-semibold text-foreground text-left">Transações de Despesas</h3>
            <p className="text-sm text-muted-foreground text-left">Todas as saídas financeiras registradas</p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
            <span className="text-xs">{listOpen ? "Ocultar" : "Mostrar"} transações</span>
            {listOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {listOpen && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 mb-4">
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
          </>
        )}
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
