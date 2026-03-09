import { Sparkles, RefreshCw, CheckCircle, Clock, BarChart3, Calendar, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { StructuredInsights } from "@/hooks/useFinanceInsights";

interface InsightsHeaderProps {
  insights: StructuredInsights | null;
  isGenerating: boolean;
  fromCache: boolean;
  cacheDate?: string;
  onRefresh: () => void;
  onToggleTraceability: () => void;
  showTraceability: boolean;
}

export function InsightsHeader({
  insights,
  isGenerating,
  fromCache,
  cacheDate,
  onRefresh,
  onToggleTraceability,
  showTraceability,
}: InsightsHeaderProps) {
  return (
    <div className="liquid-glass-card p-6 md:p-8">
      <div className="flex flex-col gap-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                Insights com IA
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Leitura estratégica dos seus dados financeiros
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleTraceability}
              className="gap-1.5 liquid-glass-chip rounded-full text-xs border-0 hover:bg-primary/5"
            >
              <FileSearch className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rastreabilidade</span>
            </Button>
            <Button
              size="sm"
              onClick={onRefresh}
              disabled={isGenerating}
              className="gap-1.5 rounded-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Analisando…
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Status chips */}
        {insights && (
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip
              icon={<BarChart3 className="w-3 h-3" />}
              label={`${insights.metadata.transactions_analyzed} transações`}
            />
            <StatusChip
              icon={<Calendar className="w-3 h-3" />}
              label={insights.metadata.period}
            />
            <StatusChip
              icon={<CheckCircle className="w-3 h-3 text-success" />}
              label="Análise validada"
              variant="success"
            />
            {fromCache && cacheDate && (
              <StatusChip
                icon={<Clock className="w-3 h-3" />}
                label={format(new Date(cacheDate), "dd/MM HH:mm", { locale: ptBR })}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChip({
  icon,
  label,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  variant?: "default" | "success";
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
        liquid-glass-chip
        ${variant === "success" ? "text-success" : "text-muted-foreground"}
      `}
    >
      {icon}
      {label}
    </span>
  );
}
