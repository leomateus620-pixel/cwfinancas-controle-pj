import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
  "hsl(0 84% 60%)",
  "hsl(221 75% 65%)",
  "hsl(142 60% 50%)",
  "hsl(38 92% 55%)",
  "hsl(262 70% 60%)",
  "hsl(190 80% 45%)",
  "hsl(328 70% 55%)",
  "hsl(45 90% 50%)",
  "hsl(160 60% 45%)",
  "hsl(15 80% 55%)",
  "hsl(270 50% 50%)",
  "hsl(200 70% 55%)",
  "hsl(100 55% 45%)",
  "hsl(350 60% 45%)",
  "hsl(180 50% 40%)",
];

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("pt-BR");

const isValidCategory = (cat: string | null | undefined): cat is string =>
  !!cat && cat.trim() !== "" && cat.toLowerCase() !== "sem categoria";

/* ── Memoized Tooltip ── */
const DonutTooltipContent = React.memo(({ active, payload, pieData }: any) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const rank = pieData.findIndex((p: any) => p.category === d.category) + 1;
  return (
    <div className="liquid-glass-tooltip min-w-[180px]">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
        <span className="text-sm font-semibold text-foreground">{d.category}</span>
        <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded-full text-muted-foreground ml-auto">
          #{rank}
        </span>
      </div>
      <p className="text-lg font-bold text-foreground">{formatCurrencyBR(d.amount)}</p>
      <p className="text-xs text-muted-foreground">{d.percent}% do total</p>
    </div>
  );
});
DonutTooltipContent.displayName = "DonutTooltipContent";

/* ── Memoized Category List Item ── */
interface CategoryListItemProps {
  entry: { category: string; amount: number; color: string; percent: string };
  index: number;
  isActive: boolean;
  count: number;
  onMouseEnter: (i: number) => void;
  onMouseLeave: () => void;
}

const CategoryListItem = React.memo(({ entry, index, isActive, count, onMouseEnter, onMouseLeave }: CategoryListItemProps) => (
  <div
    className={cn(
      "flex items-center gap-3 px-3.5 py-3 rounded-2xl cursor-default",
      "border backdrop-blur-sm",
      "transition-all duration-200 ease-out",
      isActive
        ? "bg-white/[0.10] dark:bg-white/[0.08] border-white/[0.15] dark:border-white/[0.12] shadow-[0_2px_16px_rgba(0,0,0,0.06)]"
        : "bg-white/[0.04] dark:bg-white/[0.03] border-white/[0.06] dark:border-white/[0.05] hover:bg-white/[0.07] dark:hover:bg-white/[0.06] hover:border-white/[0.10] dark:hover:border-white/[0.08] hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
    )}
    style={isActive ? {
      borderLeftColor: entry.color,
      borderLeftWidth: 3,
      boxShadow: `0 0 16px ${entry.color}15, 0 2px 12px rgba(0,0,0,0.06)`,
    } : undefined}
    onMouseEnter={() => onMouseEnter(index)}
    onMouseLeave={onMouseLeave}
  >
    {/* Rank badge */}
    <div className="flex items-center justify-center w-5 h-5 rounded-md bg-white/[0.06] dark:bg-white/[0.05] border border-white/[0.08] dark:border-white/[0.06] shrink-0">
      <span className="text-[10px] font-bold text-muted-foreground">{index + 1}</span>
    </div>
    {/* Color dot */}
    <div
      className="w-2.5 h-2.5 rounded-full shrink-0"
      style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}50` }}
    />
    {/* Name + count */}
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-medium text-foreground truncate leading-tight">{entry.category}</p>
      {count > 0 && (
        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
          {count} lançamento{count > 1 ? "s" : ""}
        </p>
      )}
    </div>
    {/* Value + percent */}
    <div className="text-right shrink-0">
      <p className="text-sm font-semibold text-foreground tabular-nums leading-tight">
        {formatCurrencyBR(entry.amount)}
      </p>
      <p className="text-[10px] text-muted-foreground tabular-nums leading-tight mt-0.5">
        {entry.percent}%
      </p>
    </div>
  </div>
));
CategoryListItem.displayName = "CategoryListItem";

/* ── Memoized Donut Chart ── */
interface DonutChartProps {
  pieData: Array<{ category: string; amount: number; color: string; percent: string }>;
  activeIndex: number | null;
  onPieEnter: (i: number) => void;
  onPieLeave: () => void;
}

const CategoryDonutChart = React.memo(({ pieData, activeIndex, onPieEnter, onPieLeave }: DonutChartProps) => {
  const hasAnimated = useRef(false);
  const shouldAnimate = !hasAnimated.current;

  useEffect(() => {
    if (!hasAnimated.current) {
      const timer = setTimeout(() => { hasAnimated.current = true; }, 900);
      return () => clearTimeout(timer);
    }
  }, []);

  const renderActiveShape = useCallback((props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 4}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    );
  }, []);

  const renderLabel = useCallback(({ cx, cy, midAngle, innerRadius, outerRadius, percent: fractionPercent, payload }: any) => {
    if (fractionPercent < 0.04) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const displayPercent = payload?.percent ?? (fractionPercent * 100).toFixed(1);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
        fontSize={11} fontWeight={600} style={{ textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
        {displayPercent}%
      </text>
    );
  }, []);

  const handleEnter = useCallback((_: any, index: number) => onPieEnter(index), [onPieEnter]);
  const handleLeave = useCallback(() => onPieLeave(), [onPieLeave]);

  const tooltipContent = useCallback(
    (props: any) => <DonutTooltipContent {...props} pieData={pieData} />,
    [pieData]
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={pieData}
          dataKey="amount"
          nameKey="category"
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={130}
          paddingAngle={3}
          animationDuration={800}
          animationEasing="ease-out"
          isAnimationActive={shouldAnimate}
          activeIndex={activeIndex !== null ? activeIndex : undefined}
          activeShape={renderActiveShape}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          label={renderLabel}
          labelLine={false}
        >
          {pieData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.color}
              stroke="hsl(var(--background))"
              strokeWidth={2}
              style={{
                opacity: activeIndex === null || activeIndex === i ? 1 : 0.4,
                transition: "opacity 150ms ease",
              }}
            />
          ))}
        </Pie>
        <Tooltip content={tooltipContent} />
      </PieChart>
    </ResponsiveContainer>
  );
});
CategoryDonutChart.displayName = "CategoryDonutChart";

export function ExpensesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState<string>("10");

  const { transactions, isLoading, totals, createTransaction, updateTransaction } = useTransactions({ type: "expense" });

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

  const allPieData = useMemo(() =>
    validCategoryBreakdown.map((item, i) => ({
      ...item,
      color: CHART_COLORS[i % CHART_COLORS.length],
      percent: totals.expense > 0
        ? ((item.amount / totals.expense) * 100).toFixed(1)
        : "0",
    })),
    [validCategoryBreakdown, totals.expense]
  );

  const pieData = useMemo(() => {
    if (visibleCount === "all") return allPieData;
    return allPieData.slice(0, Number(visibleCount));
  }, [allPieData, visibleCount]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach(t => {
      if (isValidCategory(t.category)) {
        counts[t.category] = (counts[t.category] || 0) + 1;
      }
    });
    return counts;
  }, [transactions]);

  const categoryInsights = useMemo(() => {
    if (allPieData.length === 0) return [];
    const insights: string[] = [];
    if (allPieData[0]) {
      insights.push(`"${allPieData[0].category}" lidera com ${allPieData[0].percent}% das despesas (${formatCurrencyBR(allPieData[0].amount)})`);
    }
    if (allPieData.length >= 3) {
      const top3Sum = allPieData.slice(0, 3).reduce((s, c) => s + c.amount, 0);
      const top3Pct = totals.expense > 0 ? ((top3Sum / totals.expense) * 100).toFixed(0) : "0";
      insights.push(`As 3 maiores categorias concentram ${top3Pct}% do total de despesas`);
    }
    if (allPieData.length >= 5) {
      insights.push(`${allPieData.length} categorias ativas — boa diversificação dos gastos`);
    } else if (allPieData.length >= 2) {
      insights.push(`${allPieData.length} categorias ativas no período`);
    }
    return insights.slice(0, 3);
  }, [allPieData, totals.expense]);

  const handlePieEnter = useCallback((i: number) => setActiveIndex(i), []);
  const handlePieLeave = useCallback(() => setActiveIndex(null), []);

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

      {/* ═══ CARD DOMINANTE: CATEGORIAS DE DESPESAS ═══ */}
      <div className="liquid-glass-card p-6 md:p-8 animate-fade-in" style={{ animationDelay: "250ms" }}>
        {/* Header executivo */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Categorias de Despesas</h3>
                <p className="text-xs text-muted-foreground">Análise completa de distribuição • Período selecionado</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Categorias</p>
              <p className="text-base font-bold text-foreground">{pieData.length}<span className="text-xs font-normal text-muted-foreground">/{allPieData.length}</span></p>
            </div>
            <div className="w-px h-8 bg-border/40" />
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-base font-bold text-foreground">{formatCurrencyBR(totals.expense)}</p>
            </div>
            {topCategoryData && (
              <>
                <div className="w-px h-8 bg-border/40 hidden sm:block" />
                <div className="text-center hidden sm:block">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Líder</p>
                  <p className="text-sm font-bold text-destructive truncate max-w-[120px]">{topCategoryData.category}</p>
                </div>
              </>
            )}
            <div className="w-px h-8 bg-border/40" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Exibir</p>
              <Select value={visibleCount} onValueChange={(v) => { setVisibleCount(v); setActiveIndex(null); }}>
                <SelectTrigger className="h-7 w-[90px] text-xs rounded-lg bg-white/[0.06] border-white/[0.08] backdrop-blur-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                  <SelectItem value="30">Top 30</SelectItem>
                  <SelectItem value="all">Todas ({allPieData.length})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {pieData.length > 0 ? (
          <>
            {/* Donut + Grid */}
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Donut chart */}
              <div className="w-full lg:w-[340px] shrink-0 flex justify-center">
                <div className="w-full max-w-[300px] h-[300px]">
                  <CategoryDonutChart
                    pieData={pieData}
                    activeIndex={activeIndex}
                    onPieEnter={handlePieEnter}
                    onPieLeave={handlePieLeave}
                  />
                </div>
              </div>

              {/* Category grid - premium micro-cards */}
              <div className="flex-1 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                  {pieData.map((entry, i) => (
                    <CategoryListItem
                      key={entry.category}
                      entry={entry}
                      index={i}
                      isActive={activeIndex === i}
                      count={categoryCounts[entry.category] || 0}
                      onMouseEnter={handlePieEnter}
                      onMouseLeave={handlePieLeave}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Insights analíticos */}
            {categoryInsights.length > 0 && (
              <div className="mt-6 pt-5 border-t border-border/30">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Análise</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {categoryInsights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nenhum dado disponível
          </div>
        )}
      </div>

      {/* ═══ SEÇÃO SECUNDÁRIA: Despesas Mensais + Top 5 ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Despesas Mensais */}
        <div className="liquid-glass-card p-6 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">Despesas Mensais</h3>
            <p className="text-sm text-muted-foreground">Evolução ao longo do tempo</p>
          </div>
          <div className="h-[240px]">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData}>
                  <defs>
                    <linearGradient id="expenseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
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
                    dot={{ fill: "hsl(var(--destructive))", strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: "hsl(var(--destructive))", stroke: "white", strokeWidth: 2 }}
                    animationDuration={800} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Maiores Gastos */}
        <div className="liquid-glass-card p-6 animate-fade-in" style={{ animationDelay: "350ms" }}>
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-destructive" />
              <h3 className="text-base font-semibold text-foreground">Top 5 Maiores Gastos</h3>
            </div>
            <p className="text-sm text-muted-foreground">Transações de maior valor</p>
          </div>
          {top5Transactions.length > 0 ? (
            <div className="space-y-2.5">
              {top5Transactions.map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => handleEdit(t)}
                >
                  <div className="w-6 h-6 rounded-lg bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{t.category}</span>
                      <span>•</span>
                      <span>{formatDate(t.date)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-destructive tabular-nums shrink-0">
                    -{formatCurrencyBR(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          )}
        </div>
      </div>
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
