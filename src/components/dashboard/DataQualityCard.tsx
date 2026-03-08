import { CheckCircle, AlertCircle, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuality } from "@/hooks/useFlaggedTransactions";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export function DataQualityCard() {
  const { coveragePercent, needsReviewCount, totalCount, isLoading, reasonsBreakdown } = useDataQuality();

  if (isLoading) {
    return (
      <div className="liquid-glass-card p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-16 w-16 rounded-full mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  const isExcellent = coveragePercent >= 98;
  const isGood = coveragePercent >= 95 && coveragePercent < 98;
  const needsAttention = coveragePercent < 95;

  const circleColor = isExcellent
    ? "hsl(var(--success))"
    : isGood
    ? "hsl(var(--primary))"
    : "hsl(var(--warning))";

  return (
    <div className="liquid-glass-card p-6">
      <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
        {isExcellent ? (
          <CheckCircle className="w-4 h-4 text-success" />
        ) : needsAttention ? (
          <AlertCircle className="w-4 h-4 text-warning" />
        ) : (
          <FileWarning className="w-4 h-4 text-muted-foreground" />
        )}
        Qualidade dos Dados
      </h3>
      <div className="space-y-4">
        {/* Coverage Circle */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15.91549430918954"
                fill="transparent"
                stroke="hsl(var(--muted))"
                strokeWidth="2.5"
                strokeOpacity="0.4"
              />
              <circle
                cx="18"
                cy="18"
                r="15.91549430918954"
                fill="transparent"
                stroke={circleColor}
                strokeWidth="2.5"
                strokeDasharray={`${coveragePercent} ${100 - coveragePercent}`}
                strokeLinecap="round"
                style={{
                  filter: isExcellent ? `drop-shadow(0 0 4px ${circleColor})` : 'none',
                }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {coveragePercent}%
            </span>
          </div>

          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {isExcellent ? "Excelente" : isGood ? "Boa" : "Atenção necessária"}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalCount} transações analisadas
            </p>
          </div>
        </div>

        {/* Review Count */}
        {needsReviewCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground text-xs">Para revisão</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs rounded-full",
                  needsReviewCount > 5
                    ? "border-warning/40 text-warning bg-warning/5"
                    : "border-muted-foreground/30"
                )}
              >
                {needsReviewCount} {needsReviewCount === 1 ? "item" : "itens"}
              </Badge>
            </div>

            {Object.keys(reasonsBreakdown).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(reasonsBreakdown).map(([reason, count]) => (
                  <Badge key={reason} variant="secondary" className="text-[10px] rounded-full bg-muted/40">
                    {reason.replace(/_/g, " ").toLowerCase()}: {count}
                  </Badge>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full h-8 text-xs rounded-xl" asChild>
              <Link to="/expenses?filter=review">
                Revisar Itens
              </Link>
            </Button>
          </div>
        )}

        {needsReviewCount === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            ✓ Todos os dados estão validados
          </p>
        )}
      </div>
    </div>
  );
}
