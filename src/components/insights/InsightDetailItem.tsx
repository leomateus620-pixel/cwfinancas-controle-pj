import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { buildInsightLinks } from "./insightDeepLinks";
import { cn } from "@/lib/utils";

interface InsightDetailItemProps {
  title: string;
  evidence: string;
  impact?: string;
  recommendation?: string;
  severity?: "low" | "medium" | "high";
  metadata?: {
    transactionsAnalyzed?: number;
    period?: string;
    model?: string;
  };
}

const severityConfig = {
  low: { label: "Baixo", class: "bg-success/10 text-success" },
  medium: { label: "Médio", class: "bg-warning/10 text-warning" },
  high: { label: "Alto", class: "bg-destructive/10 text-destructive" },
};

export function InsightDetailItem({
  title,
  evidence,
  impact,
  recommendation,
  severity,
  metadata,
}: InsightDetailItemProps) {
  const navigate = useNavigate();
  const [showTrace, setShowTrace] = useState(false);

  const allText = [title, evidence, impact, recommendation].filter(Boolean).join(" ");
  const links = buildInsightLinks(allText);

  return (
    <div className="liquid-glass-detail-card p-4 space-y-3 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground leading-tight flex-1">{title}</h4>
        {severity && (
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0", severityConfig[severity].class)}>
            {severityConfig[severity].label}
          </span>
        )}
      </div>

      {/* Evidence */}
      <p className="text-xs text-muted-foreground leading-relaxed">{evidence}</p>

      {/* Impact */}
      {impact && (
        <div className="flex items-start gap-2">
          <Badge variant="secondary" className="text-[10px] shrink-0 px-2 py-0">Impacto</Badge>
          <span className="text-xs text-muted-foreground">{impact}</span>
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs text-primary font-medium leading-relaxed">💡 {recommendation}</p>
        </div>
      )}

      {/* Deep links */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {links.map((link, i) => (
            <Button
              key={i}
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-[11px] text-primary/80 hover:text-primary hover:bg-primary/5 gap-1 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                navigate(link.path);
              }}
            >
              <ExternalLink className="w-3 h-3" />
              {link.label}
            </Button>
          ))}
        </div>
      )}

      {/* Traceability toggle */}
      {metadata && (
        <Collapsible open={showTrace} onOpenChange={setShowTrace}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors pt-1">
              <Info className="w-3 h-3" />
              Origem do insight
              <ChevronDown className={cn("w-3 h-3 transition-transform", showTrace && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-2.5 rounded-lg bg-muted/30 space-y-1">
              {metadata.transactionsAnalyzed && (
                <p className="text-[10px] text-muted-foreground">
                  Baseado em <span className="font-medium text-foreground/70">{metadata.transactionsAnalyzed}</span> transações
                </p>
              )}
              {metadata.period && (
                <p className="text-[10px] text-muted-foreground">
                  Período: <span className="font-medium text-foreground/70">{metadata.period}</span>
                </p>
              )}
              {metadata.model && (
                <p className="text-[10px] text-muted-foreground">
                  Modelo: <span className="font-medium text-foreground/70">{metadata.model}</span>
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
