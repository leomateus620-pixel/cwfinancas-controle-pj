import { Database, Calendar, Cpu, BarChart3, ShieldCheck } from "lucide-react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import type { StructuredInsights } from "@/hooks/useFinanceInsights";

interface InsightTraceabilityProps {
  insights: StructuredInsights;
  isOpen: boolean;
  cacheDate?: string;
}

export function InsightTraceability({ insights, isOpen, cacheDate }: InsightTraceabilityProps) {
  return (
    <Collapsible open={isOpen}>
      <CollapsibleContent>
        <div className="liquid-glass-card p-5 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Rastreabilidade dos Dados
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <TraceItem
              icon={BarChart3}
              label="Transações analisadas"
              value={String(insights.metadata.transactions_analyzed)}
            />
            <TraceItem
              icon={Calendar}
              label="Período"
              value={insights.metadata.period}
            />
            <TraceItem
              icon={Cpu}
              label="Modelo de IA"
              value={insights.metadata.model}
            />
            <TraceItem
              icon={Database}
              label="Cobertura dos dados"
              value={`${insights.data_quality.coverage_pct.toFixed(1)}%`}
              warning={insights.data_quality.coverage_pct < 80}
            />
          </div>

          {insights.data_quality.notes && (
            <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border/30 leading-relaxed">
              {insights.data_quality.notes}
            </p>
          )}

          {insights.data_quality.needs_review_count > 0 && (
            <p className="text-xs text-warning mt-2">
              ⚠ {insights.data_quality.needs_review_count} itens precisam de revisão manual.
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TraceItem({
  icon: Icon,
  label,
  value,
  warning,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{label}</p>
        <p className={`text-xs font-medium ${warning ? "text-warning" : "text-foreground/80"}`}>{value}</p>
      </div>
    </div>
  );
}
