import { useState, useMemo } from "react";
import { TrendingUp, Plus, Filter, Download, DollarSign, ShoppingCart, Briefcase, ArrowDownLeft, Loader2 } from "lucide-react";
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
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-success" />
            Análise de Receitas
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe e analise todas as suas fontes de receita.
          </p>
        </div>
        <Button className="gap-2" onClick={handleNewTransaction}>
          <Plus className="w-4 h-4" />
          Nova Receita
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Receita Total"
          value={formatCurrencyBR(totals.income)}
          changeLabel="no período selecionado"
          icon={<DollarSign className="w-5 h-5 text-success" />}
          trend="up"
        />
        <KPICard
          title="Ticket Médio"
          value={formatCurrencyBR(avgTransaction)}
          changeLabel={`${transactions.length} transações`}
          icon={<ShoppingCart className="w-5 h-5 text-primary" />}
          trend="neutral"
        />
        <KPICard
          title="Maior Fonte"
          value={topCategory}
          changeLabel="categoria principal"
          icon={<Briefcase className="w-5 h-5 text-info" />}
          trend="neutral"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receita Mensal */}
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <CardTitle className="text-lg">Receita Mensal</CardTitle>
            <CardDescription>Evolução da receita ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
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
                      tickFormatter={(value) => formatCompactBR(value)}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border border-border rounded-lg p-3 shadow-premium-lg">
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
                    <Bar dataKey="receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Categoria */}
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <CardTitle className="text-lg">Receita por Categoria</CardTitle>
            <CardDescription>Distribuição das fontes de receita</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
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
                            <div className="bg-popover border border-border rounded-lg p-3 shadow-premium-lg">
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
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {categoryData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm text-muted-foreground">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Transações */}
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Transações de Receita</CardTitle>
              <CardDescription>Todas as entradas financeiras registradas</CardDescription>
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
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => handleEdit(item)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                            <ArrowDownLeft className="w-4 h-4 text-success" />
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
        </CardContent>
      </Card>

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
