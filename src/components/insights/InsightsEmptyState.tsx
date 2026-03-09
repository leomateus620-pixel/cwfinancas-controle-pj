import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InsightsEmptyStateProps {
  isGenerating: boolean;
  onGenerate: () => void;
  hasInsufficientData?: boolean;
}

export function InsightsEmptyState({ isGenerating, onGenerate, hasInsufficientData }: InsightsEmptyStateProps) {
  return (
    <div className="liquid-glass-card p-10 md:p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 animate-float">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>

      {hasInsufficientData ? (
        <>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Dados insuficientes
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
            Não há transações suficientes para gerar uma análise confiável neste período. Importe mais dados ou amplie o intervalo de datas.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Gerar Insights com IA
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
            Analise seus dados financeiros e receba insights acionáveis, identificação de riscos e oportunidades de melhoria.
          </p>
        </>
      )}

      <Button
        onClick={onGenerate}
        disabled={isGenerating}
        size="lg"
        className="gap-2 rounded-full px-8"
      >
        {isGenerating ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Analisando…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Gerar Insights
          </>
        )}
      </Button>
    </div>
  );
}
