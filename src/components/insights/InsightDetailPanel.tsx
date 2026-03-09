import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { InsightDetailItem } from "./InsightDetailItem";
import type { Highlight, Risk, Opportunity, Anomaly, StructuredInsights } from "@/hooks/useFinanceInsights";
import type { InsightVariant } from "./InsightCategoryCard";

interface InsightDetailPanelProps {
  variant: InsightVariant;
  isOpen: boolean;
  highlights?: Highlight[];
  risks?: Risk[];
  opportunities?: Opportunity[];
  anomalies?: Anomaly[];
  metadata?: StructuredInsights["metadata"];
}

export function InsightDetailPanel({
  variant,
  isOpen,
  highlights,
  risks,
  opportunities,
  anomalies,
  metadata,
}: InsightDetailPanelProps) {
  const meta = metadata
    ? { transactionsAnalyzed: metadata.transactions_analyzed, period: metadata.period, model: metadata.model }
    : undefined;

  return (
    <Collapsible open={isOpen}>
      <CollapsibleContent>
        <div className="space-y-3 pt-2 stagger-list">
          {variant === "health" && highlights?.map((h, i) => (
            <InsightDetailItem
              key={i}
              title={h.title}
              evidence={h.evidence}
              impact={h.impact}
              recommendation={h.recommendation}
              metadata={meta}
            />
          ))}

          {variant === "risk" && risks?.map((r, i) => (
            <InsightDetailItem
              key={i}
              title={r.title}
              evidence={r.evidence}
              impact={r.mitigation}
              recommendation={r.mitigation}
              severity={r.severity}
              metadata={meta}
            />
          ))}

          {variant === "opportunity" && opportunities?.map((o, i) => (
            <InsightDetailItem
              key={i}
              title={o.title}
              evidence={o.evidence}
              impact={o.potential}
              recommendation={o.next_steps}
              metadata={meta}
            />
          ))}

          {variant === "anomaly" && anomalies?.map((a, i) => (
            <InsightDetailItem
              key={i}
              title={a.title}
              evidence={a.evidence}
              impact={a.why_unusual}
              recommendation={a.check}
              metadata={meta}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
