import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface InsightsRequest {
  connectionId?: string;
  dateFrom?: string;
  dateTo?: string;
  filters?: {
    categories?: string[];
    types?: ("income" | "expense")[];
  };
}

interface KPIs {
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  margem: number;
  receita_trend: number;
  despesa_trend: number;
}

interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
  percentage: number;
  type?: string;
}

interface MonthlyTrend {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

interface InsightsMetadata {
  period: string;
  transactions_analyzed: number;
  generated_at: string;
  model?: string;
}

export interface AIInsightsResponse {
  summary: string;
  raw_analysis: string;
  kpis: KPIs;
  category_breakdown: CategoryBreakdown[];
  monthly_trend: MonthlyTrend[];
  metadata: InsightsMetadata;
}

export function useAIInsights() {
  const { session } = useAuth();
  const { toast } = useToast();

  const generateInsights = useMutation<AIInsightsResponse, Error, InsightsRequest>({
    mutationFn: async (request) => {
      const { data, error } = await supabase.functions.invoke("ai-generate-insights", {
        body: {
          connection_id: request.connectionId,
          date_from: request.dateFrom,
          date_to: request.dateTo,
          filters: request.filters,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as AIInsightsResponse;
    },
    onError: (error) => {
      console.error("Error generating insights:", error);
      
      // Handle specific error types
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
    generateInsights,
    isLoading: generateInsights.isPending,
    data: generateInsights.data,
    error: generateInsights.error,
  };
}
