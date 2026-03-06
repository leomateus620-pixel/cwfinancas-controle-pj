import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface ForecastMonthly {
  id: string;
  month_key: string;
  receita_real: number;
  despesa_real: number;
  saldo_real: number;
  receita_prev_base: number | null;
  despesa_prev_base: number | null;
  saldo_prev_base: number | null;
  receita_prev_opt: number | null;
  receita_prev_pess: number | null;
  despesa_prev_opt: number | null;
  despesa_prev_pess: number | null;
  saldo_prev_opt: number | null;
  saldo_prev_pess: number | null;
  confidence_score: number;
  validation_status: string;
  calibration_notes: any[];
  is_forecast: boolean;
}

export interface ForecastInsights {
  id: string;
  horizon: string;
  summary: string | null;
  insights: Array<{ title: string; evidence: string; impact: string; recommendation: string }>;
  risks: Array<{ title: string; evidence: string; severity: string; mitigation: string }>;
  opportunities: Array<{ title: string; evidence: string; potential: string; next_steps: string }>;
  recommendations: Array<{ title: string; action: string; expected_impact: string }>;
  generated_at: string;
}

export function useForecast(sheetId?: string) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const forecastQuery = useQuery({
    queryKey: ["forecast-monthly", sheetId],
    queryFn: async () => {
      let query = supabase
        .from("forecast_monthly")
        .select("*")
        .order("month_key", { ascending: true });

      if (sheetId) {
        query = query.eq("sheet_id", sheetId);
      } else {
        query = query.is("sheet_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ForecastMonthly[];
    },
    enabled: !!session,
  });

  const insightsQuery = useQuery({
    queryKey: ["forecast-insights", sheetId],
    queryFn: async () => {
      let query = supabase
        .from("forecast_insights")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(1);

      if (sheetId) {
        query = query.eq("sheet_id", sheetId);
      } else {
        query = query.is("sheet_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data?.[0]) return null;
      const raw = data[0] as any;
      return {
        id: raw.id,
        horizon: raw.horizon,
        summary: raw.summary,
        insights: (raw.insights || []) as ForecastInsights["insights"],
        risks: (raw.risks || []) as ForecastInsights["risks"],
        opportunities: (raw.opportunities || []) as ForecastInsights["opportunities"],
        recommendations: (raw.recommendations || []) as ForecastInsights["recommendations"],
        generated_at: raw.generated_at,
      } as ForecastInsights;
    },
    enabled: !!session,
  });

  const generateMutation = useMutation({
    mutationFn: async (horizon: string) => {
      // Step 1: Build forecast
      const { data: buildData, error: buildError } = await supabase.functions.invoke("build-forecast", {
        body: { sheet_id: sheetId || null, horizon },
      });
      if (buildError) throw buildError;
      if (buildData?.error) throw new Error(buildData.message || buildData.error);

      // Step 2: Generate insights
      const { data: insData, error: insError } = await supabase.functions.invoke("forecast-insights", {
        body: { sheet_id: sheetId || null, horizon },
      });
      if (insError) throw insError;
      if (insData?.error) throw new Error(insData.message || insData.error);

      return { build: buildData, insights: insData };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["forecast-monthly"] });
      queryClient.invalidateQueries({ queryKey: ["forecast-insights"] });
      toast({
        title: "Previsão atualizada",
        description: `${data.build.months_real} meses reais + ${data.build.months_forecast} meses projetados. Confiança: ${data.build.confidence}%.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro na previsão",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const forecastData = forecastQuery.data || [];
  const realMonths = forecastData.filter((d) => !d.is_forecast);
  const warningMonths = realMonths.filter((d) => d.validation_status === "warning");

  return {
    forecastData,
    insights: insightsQuery.data || null,
    isLoading: forecastQuery.isLoading || insightsQuery.isLoading,
    isGenerating: generateMutation.isPending,
    generate: (horizon: string) => generateMutation.mutate(horizon),
    hasEnoughData: realMonths.length >= 2,
    hasData: forecastData.length > 0,
    validationWarnings: warningMonths.map(
      (d) => `${d.month_key}: divergência entre transações e DRE`
    ),
    confidence: forecastData[0]?.confidence_score || 0,
  };
}
