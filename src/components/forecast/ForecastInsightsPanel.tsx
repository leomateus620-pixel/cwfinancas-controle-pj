import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type { ForecastInsights } from "@/hooks/useForecast";

interface Props {
  insights: ForecastInsights | null;
}

export function ForecastInsightsPanel({ insights }: Props) {
  if (!insights) {
    return (
      <div className="liquid-glass-navy p-6 flex flex-col items-center justify-center text-center min-h-[300px]">
        <Sparkles className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">
          Gere uma previsão para ver insights da IA.
        </p>
      </div>
    );
  }

  return (
    <div className="liquid-glass-navy p-6">
      <h3 className="text-lg font-semibold text-[#0a1940] mb-1">
        Insights da Previsão
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Análise automática estilo CFO
      </p>

      {/* Summary */}
      {insights.summary && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mb-4">
          <p className="text-sm text-foreground leading-relaxed">
            {insights.summary}
          </p>
        </div>
      )}

      {/* Insights */}
      {insights.insights.length > 0 && (
        <div className="space-y-3 mb-4">
          <h4 className="text-sm font-semibold text-[#0a1940] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" />
            O que está acontecendo
          </h4>
          {insights.insights.map((item, i) => (
            <div key={i} className="p-3 rounded-xl bg-success/5 border border-success/10">
              <p className="font-medium text-sm text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.evidence}</p>
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
      {insights.risks.length > 0 && (
        <div className="space-y-3 mb-4">
          <h4 className="text-sm font-semibold text-[#0a1940] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Riscos
          </h4>
          <div className="flex flex-wrap gap-2">
            {insights.risks.map((risk, i) => (
              <div
                key={i}
                className={`px-3 py-2 rounded-xl text-xs border ${
                  risk.severity === "alto"
                    ? "bg-destructive/5 border-destructive/15 text-destructive"
                    : "bg-warning/5 border-warning/15 text-warning"
                }`}
              >
                <span className="font-medium">{risk.title}</span>
                <p className="text-muted-foreground mt-0.5">{risk.mitigation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities */}
      {insights.opportunities.length > 0 && (
        <div className="space-y-3 mb-4">
          <h4 className="text-sm font-semibold text-[#0a1940] flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-info" />
            Oportunidades
          </h4>
          {insights.opportunities.map((opp, i) => (
            <div key={i} className="p-3 rounded-xl bg-info/5 border border-info/10">
              <p className="font-medium text-sm text-foreground">{opp.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{opp.next_steps}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {insights.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[#0a1940] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            Ações sugeridas
          </h4>
          {insights.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-2 p-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{rec.title}</p>
                <p className="text-xs text-muted-foreground">{rec.action}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
