import { useState } from "react";
import { TrendingUp, Plus, Filter, Download, DollarSign, Building2, ShoppingCart, Briefcase, ArrowDownLeft } from "lucide-react";
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
import { cn } from "@/lib/utils";

// Dados de exemplo
const incomeData = [
  { id: 1, description: "Licença de Software Empresarial", category: "Vendas de Produtos", amount: 125000, date: "2024-01-15", client: "Tech Corp" },
  { id: 2, description: "Consultoria Estratégica", category: "Serviços", amount: 45000, date: "2024-01-14", client: "Empresa ABC" },
  { id: 3, description: "Assinatura Mensal Premium", category: "Assinaturas", amount: 32000, date: "2024-01-13", client: "Diversos Clientes" },
  { id: 4, description: "Treinamento Corporativo", category: "Serviços", amount: 28000, date: "2024-01-12", client: "Banco XYZ" },
  { id: 5, description: "Licença de Software - Pacote Basic", category: "Vendas de Produtos", amount: 85000, date: "2024-01-11", client: "Startup Inc" },
  { id: 6, description: "Suporte Técnico Anual", category: "Serviços", amount: 18000, date: "2024-01-10", client: "Loja Virtual" },
  { id: 7, description: "Assinatura Mensal Standard", category: "Assinaturas", amount: 24000, date: "2024-01-09", client: "Diversos Clientes" },
  { id: 8, description: "Projeto de Implementação", category: "Serviços", amount: 95000, date: "2024-01-08", client: "Indústria Ltda" },
];

const monthlyData = [
  { month: "Jan", receita: 452000 },
  { month: "Fev", receita: 398000 },
  { month: "Mar", receita: 521000 },
  { month: "Abr", receita: 467000 },
  { month: "Mai", receita: 589000 },
  { month: "Jun", receita: 634000 },
  { month: "Jul", receita: 598000 },
  { month: "Ago", receita: 672000 },
  { month: "Set", receita: 715000 },
  { month: "Out", receita: 689000 },
  { month: "Nov", receita: 743000 },
  { month: "Dez", receita: 821000 },
];

const categoryData = [
  { name: "Vendas de Produtos", value: 45, color: "hsl(var(--chart-1))" },
  { name: "Serviços", value: 35, color: "hsl(var(--chart-2))" },
  { name: "Assinaturas", value: 20, color: "hsl(var(--chart-3))" },
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

export function IncomePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredData = incomeData.filter((item) => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalIncome = incomeData.reduce((sum, item) => sum + item.amount, 0);
  const avgTransaction = totalIncome / incomeData.length;
  const topCategory = "Vendas de Produtos";

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
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Receita
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Receita Total"
          value={formatCurrency(totalIncome)}
          change={15.3}
          changeLabel="vs mês anterior"
          icon={<DollarSign className="w-5 h-5 text-success" />}
          trend="up"
        />
        <KPICard
          title="Ticket Médio"
          value={formatCurrency(avgTransaction)}
          change={8.7}
          changeLabel="vs mês anterior"
          icon={<ShoppingCart className="w-5 h-5 text-primary" />}
          trend="up"
        />
        <KPICard
          title="Maior Fonte"
          value={topCategory}
          change={12.1}
          changeLabel="crescimento"
          icon={<Briefcase className="w-5 h-5 text-info" />}
          trend="up"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receita Mensal */}
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <CardTitle className="text-lg">Receita Mensal</CardTitle>
            <CardDescription>Evolução da receita ao longo do ano</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
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
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-premium-lg">
                            <p className="text-sm font-medium text-foreground">{label}</p>
                            <p className="text-lg font-semibold text-success">
                              {formatCurrency(payload[0].value as number)}
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
                  <SelectItem value="Vendas de Produtos">Vendas de Produtos</SelectItem>
                  <SelectItem value="Serviços">Serviços</SelectItem>
                  <SelectItem value="Assinaturas">Assinaturas</SelectItem>
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
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
                    <TableCell className="text-muted-foreground">{item.client}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(item.date)}</TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      +{formatCurrency(item.amount)}
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

export default IncomePage;
