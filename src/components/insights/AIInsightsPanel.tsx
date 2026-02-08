import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  HelpCircle,
  RefreshCw,
  Clock,
  CheckCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightCard } from "./InsightCard";
import { RiskCard } from "./RiskCard";
import { useFinanceInsights, type StructuredInsights } from "@/hooks/useFinanceInsights";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIInsightsPanelProps {
  connectionId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function AIInsightsPanel({ connectionId, dateFrom, dateTo }: AIInsightsPanelProps) {
  const { 
    insights, 
    kpis, 
    isLoading, 
    isGenerating, 
    generate, 
    fromCache, 
    cacheDate 
  } = useFinanceInsights({
    connectionId,
    dateFrom,
    dateTo,
  });

  if (isLoading) {
    return <AIInsightsSkeleton />;
  }

  if (!insights) {
    return (
      <Card className="glass-premium border-border/50 shadow-premium-sm bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 animate-float">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Gerar Insights com IA
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            Analise seus dados financeiros e receba insights acionáveis, identificação de riscos e oportunidades.
          </p>
          <Button 
            onClick={() => generate()} 
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Gerar Insights
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with cache info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {fromCache && cacheDate && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(cacheDate), "dd/MM HH:mm", { locale: ptBR })}
            </Badge>
          )}
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="w-3 h-3" />
            {insights.metadata.transactions_analyzed} transações
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generate({ forceRefresh: true })}
          disabled={isGenerating}
          className="gap-2"
        >
          {isGenerating ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Atualizar
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="glass-premium border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Resumo Executivo</h3>
              <p className="text-muted-foreground leading-relaxed">{insights.summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Quality Warning */}
      {insights.data_quality.coverage_pct < 95 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-warning">Atenção: </span>
              <span className="text-muted-foreground">
                Cobertura de dados em {insights.data_quality.coverage_pct.toFixed(1)}%. 
                {insights.data_quality.needs_review_count > 0 && 
                  ` ${insights.data_quality.needs_review_count} itens precisam de revisão.`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Highlights */}
      {insights.highlights.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" />
            Destaques
          </h3>
          <div className="grid gap-3">
            {insights.highlights.map((highlight, idx) => (
              <InsightCard
                key={idx}
                icon={TrendingUp}
                title={highlight.title}
                evidence={highlight.evidence}
                impact={highlight.impact}
                recommendation={highlight.recommendation}
                variant="success"
              />
            ))}
          </div>
        </section>
      )}

      {/* Risks */}
      {insights.risks.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Riscos Identificados
          </h3>
          <div className="grid gap-3">
            {insights.risks.map((risk, idx) => (
              <RiskCard
                key={idx}
                title={risk.title}
                evidence={risk.evidence}
                severity={risk.severity}
                mitigation={risk.mitigation}
              />
            ))}
          </div>
        </section>
      )}

      {/* Opportunities */}
      {insights.opportunities.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            Oportunidades
          </h3>
          <div className="grid gap-3">
            {insights.opportunities.map((opp, idx) => (
              <InsightCard
                key={idx}
                icon={Lightbulb}
                title={opp.title}
                evidence={opp.evidence}
                impact={opp.potential}
                recommendation={opp.next_steps}
                variant="info"
              />
            ))}
          </div>
        </section>
      )}

      {/* Anomalies */}
      {insights.anomalies.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Anomalias
          </h3>
          <div className="grid gap-3">
            {insights.anomalies.map((anomaly, idx) => (
              <InsightCard
                key={idx}
                icon={AlertTriangle}
                title={anomaly.title}
                evidence={anomaly.evidence}
                impact={anomaly.why_unusual}
                recommendation={anomaly.check}
                variant="warning"
              />
            ))}
          </div>
        </section>
      )}

      {/* Questions to Investigate */}
      {insights.questions.length > 0 && (
        <Card className="glass-premium border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
              Perguntas para Investigar
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {insights.questions.map((question, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary font-medium shrink-0">{idx + 1}.</span>
                  {question}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <p className="text-xs text-muted-foreground text-center">
        Período: {insights.metadata.period} • Modelo: {insights.metadata.model}
      </p>
    </div>
  );
}

function AIInsightsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
