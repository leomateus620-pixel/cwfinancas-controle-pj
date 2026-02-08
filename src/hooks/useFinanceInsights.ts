import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Highlight {
  title: string;
  evidence: string;
  impact: string;
  recommendation: string;
}

export interface Risk {
  title: string;
  evidence: string;
  severity: "low" | "medium" | "high";
  mitigation: string;
}

export interface Opportunity {
  title: string;
  evidence: string;
  potential: string;
  next_steps: string;
}

export interface Anomaly {
  title: string;
  evidence: string;
  why_unusual: string;
  check: string;
}

export interface DataQualityInfo {
  coverage_pct: number;
  needs_review_count: number;
  notes: string;
}

export interface KPIs {
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  margem: number;
  receita_trend: number;
  despesa_trend: number;
}

export interface StructuredInsights {
  summary: string;
  highlights: Highlight[];
  risks: Risk[];
  opportunities: Opportunity[];
  anomalies: Anomaly[];
  questions: string[];
  data_quality: DataQualityInfo;
  metadata: {
    period: string;
    transactions_analyzed: number;
    generated_at: string;
    model: string;
  };
}

export interface AIInsightsResponse {
  id: string;
  kpis: KPIs;
  insights: StructuredInsights;
  created_at: string;
}

interface InsightsParams {
  connectionId?: string;
  dateFrom?: string;
  dateTo?: string;
  filters?: {
    categories?: string[];
    types?: ("income" | "expense")[];
  };
  forceRefresh?: boolean;
}

export function useFinanceInsights(params: InsightsParams = {}) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check for cached insights
  const {
    data: cachedInsights,
    isLoading: isCacheLoading,
  } = useQuery<AIInsightsResponse | null>({
    queryKey: ["ai-insights-cache", params.connectionId, params.dateFrom, params.dateTo],
    queryFn: async () => {
      const query = supabase
        .from("ai_insights")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (params.connectionId) {
        query.eq("connected_sheet_id", params.connectionId);
      }
      if (params.dateFrom) {
        query.gte("date_from", params.dateFrom);
      }
      if (params.dateTo) {
        query.lte("date_to", params.dateTo);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      if (!data) return null;

      // Check if cache is fresh (< 24 hours)
      const cacheAge = Date.now() - new Date(data.created_at).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (cacheAge > twentyFourHours) {
        return null;
      }

      return {
        id: data.id,
        kpis: data.kpis as unknown as KPIs,
        insights: data.insights as unknown as StructuredInsights,
        created_at: data.created_at,
      };
    },
    enabled: !!session?.user && !params.forceRefresh,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const generateMutation = useMutation<AIInsightsResponse, Error, InsightsParams>({
    mutationFn: async (generateParams) => {
      const { data, error } = await supabase.functions.invoke("ai-generate-insights", {
        body: {
          connection_id: generateParams.connectionId,
          date_from: generateParams.dateFrom,
          date_to: generateParams.dateTo,
          filters: generateParams.filters,
          force_refresh: generateParams.forceRefresh,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as AIInsightsResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["ai-insights-cache", params.connectionId, params.dateFrom, params.dateTo],
        data
      );
      toast({
        title: "Insights gerados",
        description: `Análise de ${data.insights.metadata.transactions_analyzed} transações concluída.`,
      });
    },
    onError: (error) => {
      console.error("Error generating insights:", error);
      
      if (error.message.includes("Rate limits") || error.message.includes("429")) {
        toast({
          title: "Limite excedido",
          description: "Aguarde alguns minutos e tente novamente.",
          variant: "destructive",
        });
      } else if (error.message.includes("Créditos") || error.message.includes("402")) {
        toast({
          title: "Créditos insuficientes",
          description: "Adicione créditos de IA ao seu workspace.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao gerar insights",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  return {
    insights: cachedInsights?.insights || generateMutation.data?.insights || null,
    kpis: cachedInsights?.kpis || generateMutation.data?.kpis || null,
    isLoading: isCacheLoading,
    isGenerating: generateMutation.isPending,
    generate: (overrideParams?: Partial<InsightsParams>) => 
      generateMutation.mutate({ ...params, ...overrideParams }),
    error: generateMutation.error,
    fromCache: !!cachedInsights && !generateMutation.data,
    cacheDate: cachedInsights?.created_at,
  };
}
