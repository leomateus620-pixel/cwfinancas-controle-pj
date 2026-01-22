import { Sparkles, TrendingUp, AlertTriangle, LineChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const insights = [
  {
    id: 1,
    type: "trend",
    title: "Crescimento de Receita Detectado",
    description: "Sua receita do Q4 mostra um aumento de 23% comparado ao Q3. Os investimentos em marketing estão dando resultado.",
    icon: TrendingUp,
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    id: 2,
    type: "anomaly",
    title: "Pico Incomum de Despesas",
    description: "Os gastos com tecnologia aumentaram 45% em dezembro. Isso pode necessitar de revisão.",
    icon: AlertTriangle,
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  {
    id: 3,
    type: "forecast",
    title: "Projeção Q1 2025",
    description: "Com base nas tendências atuais, a receita projetada para o Q1 2025 é de R$ 4,2M com 85% de confiança.",
    icon: LineChart,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
];

export function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-primary" />
          Insights com IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Análise inteligente dos seus dados financeiros.
        </p>
      </div>
      
      <div className="grid gap-4">
        {insights.map((insight) => (
          <Card 
            key={insight.id} 
            className="border-border/50 shadow-premium-sm hover:shadow-premium-md transition-premium animate-fade-in"
          >
            <CardHeader className="pb-2">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl ${insight.bgColor} flex items-center justify-center shrink-0`}>
                  <insight.icon className={`w-5 h-5 ${insight.color}`} />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">{insight.title}</CardTitle>
                  <CardDescription className="mt-1.5 text-sm leading-relaxed">
                    {insight.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 shadow-premium-sm bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-8 text-center">
          <Sparkles className="w-12 h-12 text-primary/60 mx-auto mb-4" />
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
