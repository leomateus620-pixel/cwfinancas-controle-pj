import { useState } from "react";
import { Heart, AlertTriangle, Lightbulb, Search } from "lucide-react";
import { InsightCategoryCard, type InsightVariant } from "./InsightCategoryCard";
import { InsightDetailPanel } from "./InsightDetailPanel";
import { formatCurrencyBR } from "@/lib/currency";
import type { StructuredInsights, KPIs } from "@/hooks/useFinanceInsights";

interface InsightsSummaryGridProps {
  insights: StructuredInsights;
  kpis: KPIs;
}

export function InsightsSummaryGrid({ insights, kpis }: InsightsSummaryGridProps) {
  const [expandedCard, setExpandedCard] = useState<InsightVariant | null>(null);

  const toggleCard = (variant: InsightVariant) => {
    setExpandedCard((prev) => (prev === variant ? null : variant));
  };

  // Determine health priority
  const healthPriority = kpis.saldo < 0 ? "alta" : kpis.margem < 10 ? "média" : "baixa";
  const healthSummary = insights.summary
    ? insights.summary.length > 120
      ? insights.summary.slice(0, 120) + "…"
      : insights.summary
    : "Resumo executivo do período analisado.";

  // Risk priority
  const sortedRisks = [...insights.risks].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
  const topRiskSeverity = sortedRisks[0]?.severity;
  const riskPriority = topRiskSeverity === "high" ? "alta" : topRiskSeverity === "medium" ? "média" : "baixa";
  const riskSummary = sortedRisks[0]?.title || "Nenhum risco identificado no período.";

  // Opportunity
  const oppSummary = insights.opportunities[0]?.title || "Nenhuma oportunidade identificada.";

  // Anomaly
  const anomalySummary = insights.anomalies[0]?.title || "Nenhuma anomalia detectada.";

  const cards: {
    variant: InsightVariant;
    icon: typeof Heart;
    title: string;
    summary: string;
    priority: "alta" | "média" | "baixa";
    metrics: { label: string; value: string }[];
    count: number;
  }[] = [
    {
      variant: "health",
      icon: Heart,
      title: "Saúde Financeira",
      summary: healthSummary,
      priority: healthPriority,
      metrics: [
        { label: "Resultado", value: formatCurrencyBR(kpis.saldo) },
        { label: "Margem", value: `${kpis.margem.toFixed(1)}%` },
      ],
      count: insights.highlights.length || 1,
    },
    {
      variant: "risk",
      icon: AlertTriangle,
      title: "Principais Riscos",
      summary: riskSummary,
      priority: riskPriority,
      metrics: [
        { label: "Riscos", value: String(insights.risks.length) },
        ...(topRiskSeverity ? [{ label: "Severidade", value: topRiskSeverity === "high" ? "Alta" : topRiskSeverity === "medium" ? "Média" : "Baixa" }] : []),
      ],
      count: insights.risks.length,
    },
    {
      variant: "opportunity",
      icon: Lightbulb,
      title: "Oportunidades",
      summary: oppSummary,
      priority: insights.opportunities.length > 2 ? "alta" : insights.opportunities.length > 0 ? "média" : "baixa",
      metrics: [
        { label: "Encontradas", value: String(insights.opportunities.length) },
      ],
      count: insights.opportunities.length,
    },
    {
      variant: "anomaly",
      icon: Search,
      title: "Anomalias",
      summary: anomalySummary,
      priority: insights.anomalies.length > 2 ? "alta" : insights.anomalies.length > 0 ? "média" : "baixa",
      metrics: [
        { label: "Detectadas", value: String(insights.anomalies.length) },
      ],
      count: insights.anomalies.length,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Data quality warning */}
      {insights.data_quality.coverage_pct < 80 && (
        <div className="liquid-glass-compact p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-warning">Confiança reduzida</span> — cobertura de dados em{" "}
            {insights.data_quality.coverage_pct.toFixed(1)}%. Insights podem ser parciais.
          </p>
        </div>
      )}

      {/* 4-card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {cards.map((card) => (
          <InsightCategoryCard
            key={card.variant}
            variant={card.variant}
            icon={card.icon}
            title={card.title}
            summary={card.summary}
            priority={card.priority}
            metrics={card.metrics}
            itemCount={card.count}
            isExpanded={expandedCard === card.variant}
            onClick={() => toggleCard(card.variant)}
          />
        ))}
      </div>

      {/* Detail panel */}
      {expandedCard && (
        <InsightDetailPanel
          variant={expandedCard}
          isOpen={!!expandedCard}
          highlights={insights.highlights}
          risks={sortedRisks}
          opportunities={insights.opportunities}
          anomalies={insights.anomalies}
          metadata={insights.metadata}
        />
      )}

      {/* Questions */}
      {insights.questions.length > 0 && !expandedCard && (
        <div className="liquid-glass-compact p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            Perguntas para Investigar
          </h3>
          <ul className="space-y-1.5">
            {insights.questions.map((q, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
