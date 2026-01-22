import { useState } from "react";
import { TrendingDown, Plus, Filter, Download, CreditCard, Building2, Laptop, Megaphone, ArrowUpRight, AlertTriangle } from "lucide-react";
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
  LineChart,
  Line,
  Cell
} from "recharts";
import { KPICard } from "@/components/dashboard/KPICard";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

// Dados de exemplo
const expenseData = [
  { id: 1, description: "Folha de Pagamento", category: "Salários", amount: 185000, date: "2024-01-15", vendor: "Interno" },
  { id: 2, description: "Google Ads - Campanha Q1", category: "Marketing", amount: 45000, date: "2024-01-14", vendor: "Google" },
  { id: 3, description: "Servidores AWS", category: "Tecnologia", amount: 28000, date: "2024-01-13", vendor: "Amazon" },
  { id: 4, description: "Aluguel do Escritório", category: "Operações", amount: 22000, date: "2024-01-12", vendor: "Imobiliária XYZ" },
  { id: 5, description: "Licenças de Software", category: "Tecnologia", amount: 15000, date: "2024-01-11", vendor: "Microsoft" },
  { id: 6, description: "Material de Escritório", category: "Operações", amount: 3500, date: "2024-01-10", vendor: "Papelaria" },
  { id: 7, description: "Facebook Ads", category: "Marketing", amount: 18000, date: "2024-01-09", vendor: "Meta" },
  { id: 8, description: "Consultoria Jurídica", category: "Serviços", amount: 12000, date: "2024-01-08", vendor: "Escritório ABC" },
];

const monthlyExpenseData = [
  { month: "Jan", despesas: 328500, orcamento: 350000 },
  { month: "Fev", despesas: 312000, orcamento: 350000 },
  { month: "Mar", despesas: 345000, orcamento: 350000 },
  { month: "Abr", despesas: 298000, orcamento: 350000 },
  { month: "Mai", despesas: 378000, orcamento: 350000 },
  { month: "Jun", despesas: 342000, orcamento: 350000 },
  { month: "Jul", despesas: 315000, orcamento: 350000 },
  { month: "Ago", despesas: 356000, orcamento: 350000 },
  { month: "Set", despesas: 389000, orcamento: 380000 },
  { month: "Out", despesas: 367000, orcamento: 380000 },
  { month: "Nov", despesas: 398000, orcamento: 380000 },
  { month: "Dez", despesas: 425000, orcamento: 400000 },
];

const categoryBreakdown = [
  { category: "Salários", amount: 485000, budget: 500000, color: "hsl(var(--chart-1))" },
  { category: "Marketing", amount: 128000, budget: 150000, color: "hsl(var(--chart-2))" },
  { category: "Tecnologia", amount: 95000, budget: 100000, color: "hsl(var(--chart-3))" },
  { category: "Operações", amount: 82000, budget: 80000, color: "hsl(var(--chart-4))" },
  { category: "Serviços", amount: 45000, budget: 50000, color: "hsl(var(--chart-5))" },
];

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

  const filteredData = expenseData.filter((item) => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalExpenses = expenseData.reduce((sum, item) => sum + item.amount, 0);
  const budgetTotal = 1500000;
  const budgetUsed = (totalExpenses / budgetTotal) * 100;

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
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Despesa
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Total de Despesas"
          value={formatCurrency(totalExpenses)}
          change={-5.2}
          changeLabel="vs mês anterior"
          icon={<CreditCard className="w-5 h-5 text-destructive" />}
          trend="down"
        />
        <KPICard
          title="Maior Categoria"
          value="Salários"
          change={3.1}
          changeLabel="do total"
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
        {/* Despesas vs Orçamento */}
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <CardTitle className="text-lg">Despesas vs Orçamento</CardTitle>
            <CardDescription>Comparação mensal de gastos e orçamento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyExpenseData}>
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
                            <p className="text-sm text-muted-foreground">
                              Orçamento: {formatCurrency(payload[1].value as number)}
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
                  <Line 
                    type="monotone" 
                    dataKey="orcamento" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gastos por Categoria */}
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <CardTitle className="text-lg">Gastos por Categoria</CardTitle>
            <CardDescription>Progresso vs orçamento por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryBreakdown.map((item, index) => {
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
                        {formatCurrency(item.amount)} / {formatCurrency(item.budget)}
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
                    <p className={cn(
                      "text-xs",
                      isOverBudget ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {percentage.toFixed(1)}% do orçamento
                      {isOverBudget && " - Acima do limite!"}
                    </p>
                  </div>
                );
              })}
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
                  <SelectItem value="Salários">Salários</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Tecnologia">Tecnologia</SelectItem>
                  <SelectItem value="Operações">Operações</SelectItem>
                  <SelectItem value="Serviços">Serviços</SelectItem>
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
                {filteredData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
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
                    <TableCell className="text-muted-foreground">{item.vendor}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(item.date)}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      -{formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ExpensesPage;
