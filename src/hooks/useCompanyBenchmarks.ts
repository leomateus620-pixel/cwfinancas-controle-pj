import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BenchmarkData {
  margem_liquida: number;
  crescimento_anual: number;
  despesas_sobre_faturamento: number;
  descricao: string;
}

export interface BenchmarkResult {
  benchmark: BenchmarkData;
  aiInsights: string | null;
  setor: string;
  porte: string;
}

export function useCompanyBenchmarks() {
  const [data, setData] = useState<BenchmarkResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchBenchmarks = useCallback(async (params: {
    setor: string | null;
    porte: string | null;
    kpis: {
      margem?: number;
      receita?: number;
      despesa?: number;
      crescimentoReceita?: number;
      despesaSobreReceita?: number;
    };
  }) => {
    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("company-benchmarks", {
        body: params,
      });
      if (error) throw error;
      setData(result as BenchmarkResult);
    } catch (e) {
      console.error("Benchmark error:", e);
      toast({ variant: "destructive", title: "Erro ao buscar benchmarks", description: "Tente novamente." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return { data, isLoading, fetchBenchmarks };
}
