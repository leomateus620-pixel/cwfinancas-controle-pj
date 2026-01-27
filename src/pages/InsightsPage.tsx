import { Sparkles, TrendingUp, AlertTriangle, LineChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { cn } from "@/lib/utils";

const insights = [
  {
    id: 1,
    type: "trend",
    title: "Crescimento de Receita Detectado",
    description: "Sua receita do Q4 mostra um aumento de 23% comparado ao Q3. Os investimentos em marketing estão dando resultado.",
    icon: TrendingUp,
    color: "text-success",
    bgColor: "bg-success/10",
    status: "success" as const,
  },
  {
    id: 2,
    type: "anomaly",
    title: "Pico Incomum de Despesas",
    description: "Os gastos com tecnologia aumentaram 45% em dezembro. Isso pode necessitar de revisão.",
    icon: AlertTriangle,
    color: "text-warning",
    bgColor: "bg-warning/10",
    status: "warning" as const,
  },
  {
    id: 3,
    type: "forecast",
    title: "Projeção Q1 2025",
    description: "Com base nas tendências atuais, a receita projetada para o Q1 2025 é de R$ 4,2M com 85% de confiança.",
    icon: LineChart,
    color: "text-primary",
    bgColor: "bg-primary/10",
    status: "info" as const,
  },
];

export function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-primary animate-pulse-glow" />
          Insights com IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Análise inteligente dos seus dados financeiros.
        </p>
      </div>
      
      <div className="grid gap-4 stagger-children">
        {insights.map((insight, index) => (
          <Card 
            key={insight.id} 
            className={cn(
              "glass-premium border-border/50 shadow-premium-sm hover:shadow-premium-md transition-premium",
              "cursor-pointer group overflow-hidden relative"
            )}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            {/* Gradient overlay */}
            <div className={cn(
              "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
              insight.bgColor.replace('/10', '/5')
            )} />
            
            <CardHeader className="pb-2 relative z-10">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110",
                  insight.bgColor
                )}>
                  <insight.icon className={cn("w-6 h-6", insight.color)} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                      {insight.title}
                    </CardTitle>
                    <StatusIndicator status={insight.status} size="sm" pulse={false} />
                  </div>
                  <CardDescription className="mt-2 text-sm leading-relaxed">
                    {insight.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="glass-premium border-border/50 shadow-premium-sm bg-gradient-to-br from-primary/5 to-transparent overflow-hidden relative">
        <div className="absolute inset-0 gradient-mesh opacity-40 pointer-events-none" />
        <CardContent className="py-10 text-center relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 animate-float">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Mais Insights Disponíveis
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Faça upload dos seus dados financeiros para desbloquear insights personalizados com IA, análise de tendências e previsões.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default InsightsPage;
