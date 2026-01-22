import { LineChart as LineChartIcon, TrendingUp, TrendingDown, Target, Calendar, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AreaChart, 
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { KPICard } from "@/components/dashboard/KPICard";
import { useState } from "react";

// Dados de previsão com intervalos de confiança
const forecastData = [
  { month: "Jan 24", real: 452000, previsto: null, otimista: null, pessimista: null },
  { month: "Fev 24", real: 398000, previsto: null, otimista: null, pessimista: null },
  { month: "Mar 24", real: 521000, previsto: null, otimista: null, pessimista: null },
  { month: "Abr 24", real: 467000, previsto: null, otimista: null, pessimista: null },
  { month: "Mai 24", real: 589000, previsto: null, otimista: null, pessimista: null },
  { month: "Jun 24", real: 634000, previsto: null, otimista: null, pessimista: null },
  { month: "Jul 24", real: 598000, previsto: null, otimista: null, pessimista: null },
  { month: "Ago 24", real: 672000, previsto: null, otimista: null, pessimista: null },
  { month: "Set 24", real: 715000, previsto: null, otimista: null, pessimista: null },
  { month: "Out 24", real: 689000, previsto: null, otimista: null, pessimista: null },
  { month: "Nov 24", real: 743000, previsto: null, otimista: null, pessimista: null },
  { month: "Dez 24", real: 821000, previsto: 821000, otimista: 821000, pessimista: 821000 },
  { month: "Jan 25", real: null, previsto: 856000, otimista: 920000, pessimista: 792000 },
  { month: "Fev 25", real: null, previsto: 892000, otimista: 978000, pessimista: 806000 },
  { month: "Mar 25", real: null, previsto: 945000, otimista: 1050000, pessimista: 840000 },
  { month: "Abr 25", real: null, previsto: 978000, otimista: 1095000, pessimista: 861000 },
  { month: "Mai 25", real: null, previsto: 1024000, otimista: 1156000, pessimista: 892000 },
  { month: "Jun 25", real: null, previsto: 1089000, otimista: 1234000, pessimista: 944000 },
];

const cashFlowData = [
  { month: "Jan 25", entradas: 856000, saidas: 428000, saldo: 428000 },
  { month: "Fev 25", entradas: 892000, saidas: 445000, saldo: 447000 },
  { month: "Mar 25", entradas: 945000, saidas: 467000, saldo: 478000 },
  { month: "Abr 25", entradas: 978000, saidas: 485000, saldo: 493000 },
  { month: "Mai 25", entradas: 1024000, saidas: 512000, saldo: 512000 },
  { month: "Jun 25", entradas: 1089000, saidas: 545000, saldo: 544000 },
];

const insights = [
  {
    title: "Crescimento Esperado",
    description: "Com base nas tendências, espera-se um crescimento de 32% no primeiro semestre de 2025.",
    type: "positive",
  },
  {
    title: "Sazonalidade Identificada",
    description: "Pico de receitas identificado entre setembro e dezembro. Planeje investimentos para este período.",
    type: "info",
  },
  {
    title: "Alerta de Fluxo de Caixa",
    description: "Fevereiro pode ter pressão no fluxo de caixa. Considere reservar capital extra.",
    type: "warning",
  },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

export function ForecastsPage() {
  const [period, setPeriod] = useState("6");

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
            <LineChartIcon className="w-7 h-7 text-primary" />
            Previsões Financeiras
          </h1>
          <p className="text-muted-foreground mt-1">
            Projeções baseadas em IA para o futuro da sua empresa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Próximos 3 meses</SelectItem>
              <SelectItem value="6">Próximos 6 meses</SelectItem>
              <SelectItem value="12">Próximos 12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">Atualizar Previsão</Button>
        </div>
      </div>

      {/* KPIs de Previsão */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Receita Prevista Q1"
          value="R$ 2,69M"
          change={28.5}
          changeLabel="vs Q4 2024"
          icon={<TrendingUp className="w-5 h-5 text-success" />}
          trend="up"
        />
        <KPICard
          title="Margem Projetada"
          value="42,3%"
          change={3.2}
          changeLabel="melhoria prevista"
          icon={<Target className="w-5 h-5 text-primary" />}
          trend="up"
        />
        <KPICard
          title="Confiança da Previsão"
          value="85%"
          change={0}
          changeLabel="alta confiabilidade"
          icon={<AlertCircle className="w-5 h-5 text-info" />}
          trend="neutral"
        />
      </div>

      {/* Gráfico de Previsão Principal */}
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="text-lg">Projeção de Receita</CardTitle>
          <CardDescription>
            Histórico e previsão com intervalos de confiança (otimista, esperado, pessimista)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="realGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  interval={1}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickFormatter={formatCurrency}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border border-border rounded-lg p-3 shadow-premium-lg">
                          <p className="text-sm font-medium text-foreground mb-2">{label}</p>
                          {payload.map((entry: any, index: number) => (
                            entry.value && (
                              <p key={index} className="text-sm" style={{ color: entry.color }}>
                                {entry.dataKey === 'real' ? 'Real' : 
                                 entry.dataKey === 'previsto' ? 'Previsto' :
                                 entry.dataKey === 'otimista' ? 'Otimista' : 'Pessimista'}
                                : {formatCurrency(entry.value)}
                              </p>
                            )
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine 
                  x="Dez 24" 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="3 3"
                  label={{ value: "Hoje", position: "top", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                
                {/* Área de intervalo (otimista - pessimista) */}
                <Area
                  type="monotone"
                  dataKey="otimista"
                  stroke="transparent"
                  fill="url(#rangeGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="pessimista"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  fill="transparent"
                />
                
                {/* Linha de previsão */}
                <Area
                  type="monotone"
                  dataKey="previsto"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  fill="url(#forecastGradient)"
                />
                
                {/* Dados reais */}
                <Area
                  type="monotone"
                  dataKey="real"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#realGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-1))]" />
              <span className="text-sm text-muted-foreground">Dados Reais</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-sm text-muted-foreground">Previsão</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
              <span className="text-sm text-muted-foreground">Intervalo de Confiança</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Segunda linha */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Previsão de Fluxo de Caixa */}
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <CardTitle className="text-lg">Fluxo de Caixa Projetado</CardTitle>
            <CardDescription>Entradas, saídas e saldo previsto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cashFlowData.slice(0, 4).map((item, index) => (
                <div key={index} className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{item.month}</span>
                    <span className="text-lg font-semibold text-success">
                      +{formatCurrency(item.saldo)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-success">
                      ↓ {formatCurrency(item.entradas)}
                    </span>
                    <span className="text-destructive">
                      ↑ {formatCurrency(item.saidas)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Insights da IA */}
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <CardTitle className="text-lg">Insights da Previsão</CardTitle>
            <CardDescription>Análises automáticas baseadas nos dados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-xl border ${
                    insight.type === 'positive' ? 'bg-success/5 border-success/20' :
                    insight.type === 'warning' ? 'bg-warning/5 border-warning/20' :
                    'bg-info/5 border-info/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {insight.type === 'positive' ? (
                      <TrendingUp className="w-5 h-5 text-success shrink-0 mt-0.5" />
                    ) : insight.type === 'warning' ? (
                      <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                    ) : (
                      <LineChartIcon className="w-5 h-5 text-info shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">{insight.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ForecastsPage;
