import { useState } from "react";
import { InsightsHeader } from "@/components/insights/InsightsHeader";
import { InsightsSummaryGrid } from "@/components/insights/InsightsSummaryGrid";
import { InsightsEmptyState } from "@/components/insights/InsightsEmptyState";
import { InsightsSkeleton } from "@/components/insights/InsightsSkeleton";
import { InsightTraceability } from "@/components/insights/InsightTraceability";
import { useFinanceInsights } from "@/hooks/useFinanceInsights";

interface AIInsightsPanelProps {
  connectionId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function AIInsightsPanel({ connectionId, dateFrom, dateTo }: AIInsightsPanelProps) {
  const [showTraceability, setShowTraceability] = useState(false);

  const {
    insights,
    kpis,
    isLoading,
    isGenerating,
    generate,
    fromCache,
    cacheDate,
  } = useFinanceInsights({ connectionId, dateFrom, dateTo });

  if (isLoading) {
    return <InsightsSkeleton />;
  }

  if (!insights || !kpis) {
    return (
      <InsightsEmptyState
        isGenerating={isGenerating}
        onGenerate={() => generate()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <InsightsHeader
        insights={insights}
        isGenerating={isGenerating}
        fromCache={!!fromCache}
        cacheDate={cacheDate}
        onRefresh={() => generate({ forceRefresh: true })}
        onToggleTraceability={() => setShowTraceability((v) => !v)}
        showTraceability={showTraceability}
      />

      <InsightTraceability
        insights={insights}
        isOpen={showTraceability}
        cacheDate={cacheDate}
      />

      <InsightsSummaryGrid insights={insights} kpis={kpis} />
    </div>
  );
}
