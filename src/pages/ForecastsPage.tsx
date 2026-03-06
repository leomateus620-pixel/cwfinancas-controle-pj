import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart as LineChartIcon,
  Calendar,
  Loader2,
  RefreshCw,
  Monitor,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForecast } from "@/hooks/useForecast";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import { ForecastChart } from "@/components/forecast/ForecastChart";
import { ForecastKPIs } from "@/components/forecast/ForecastKPIs";
import { ForecastCashFlow } from "@/components/forecast/ForecastCashFlow";
import { ForecastInsightsPanel } from "@/components/forecast/ForecastInsightsPanel";

export function ForecastsPage() {
  const [horizon, setHorizon] = useState("6m");
  const navigate = useNavigate();
  const {
    forecastData,
    insights,
    isLoading,
    isGenerating,
    generate,
    hasEnoughData,
    hasData,
    validationWarnings,
    confidence,
  } = useForecast();

  const realMonths = forecastData.filter((d) => !d.is_forecast);
  const forecastMonths = forecastData.filter((d) => d.is_forecast);

  return (
    <>
      {/* Mobile placeholder */}
      <div className="lg:hidden flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <Monitor className="w-16 h-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Previsões financeiras
        </h2>
        <p className="text-muted-foreground">
          Disponível apenas no desktop para melhor visualização dos dados.
        </p>
      </div>

      {/* Desktop content */}
      <div className="hidden lg:block space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
              <LineChartIcon className="w-7 h-7 text-primary" />
              Previsões Financeiras
            </h1>
            <p className="text-muted-foreground mt-1">
              Projeções baseadas em dados reais + validação com DRE.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={horizon} onValueChange={setHorizon}>
              <SelectTrigger className="w-[180px] liquid-glass-bank-card border-0">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">Próximos 3 meses</SelectItem>
                <SelectItem value="6m">Próximos 6 meses</SelectItem>
                <SelectItem value="12m">Próximos 12 meses</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => generate(horizon)}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isGenerating ? "Gerando..." : "Atualizar Previsão"}
            </Button>
          </div>
        </div>

        {/* Validation warnings */}
        {validationWarnings.length > 0 && (
          <div className="liquid-glass-caixa p-4 flex items-start gap-3 border-l-[3px] border-l-amber-500">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">
                Divergência detectada entre transações e DRE
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Ajuste aplicado automaticamente em {validationWarnings.length} mês(es) usando DRE como referência.
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-[400px] rounded-2xl" />
          </div>
        )}

        {/* Generating state */}
        {isGenerating && (
          <div className="liquid-glass-caixa relative overflow-hidden p-12 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-foreground">
                Calculando previsões...
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Consolidando transações, validando com DRE e gerando insights.
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isGenerating && !hasData && (
          <div className="liquid-glass-caixa relative overflow-hidden p-12 flex flex-col items-center gap-4 text-center">
            <LineChartIcon className="w-14 h-14 text-muted-foreground/40" />
            <h3 className="text-xl font-semibold text-foreground">
              Nenhuma previsão gerada ainda
            </h3>
            <p className="text-muted-foreground max-w-md">
              Sincronize pelo menos 2 meses de transações + DRE para gerar previsões financeiras inteligentes.
            </p>
            <Button onClick={() => generate(horizon)} disabled={isGenerating} className="mt-2 gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {isGenerating ? "Gerando..." : "Gerar Previsão"}
            </Button>
          </div>
        )}

        {/* Dashboard with data */}
        {!isLoading && !isGenerating && hasData && (
          <div className="space-y-6">
            <ForecastKPIs
              realMonths={realMonths}
              forecastMonths={forecastMonths}
              confidence={confidence}
            />
            <ForecastChart forecastData={forecastData} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ForecastCashFlow forecastMonths={forecastMonths} />
              <ForecastInsightsPanel insights={insights} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ForecastsPage;
