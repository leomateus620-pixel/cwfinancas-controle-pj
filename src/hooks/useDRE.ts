import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface DREPeriod {
  id: string;
  user_id: string;
  sheet_id: string | null;
  period_key: string;
  period_label: string | null;
  col_index: number | null;
  validation_status: string;
  validation_notes: string[];
  last_import_at: string;
}

interface DRELine {
  id: string;
  period_id: string;
  user_id: string;
  group_label: string | null;
  line_label: string;
  value: number;
  source_cell: string | null;
  source_tab: string | null;
  order_index: number;
  is_group: boolean;
  is_subtotal: boolean;
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function useDRE(sheetId?: string) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch periods
  const {
    data: periods,
    isLoading: isLoadingPeriods,
  } = useQuery({
    queryKey: ["dre-periods-v2", sheetId],
    queryFn: async () => {
      let query = supabase
        .from("dre_periods")
        .select("*")
        .order("period_key", { ascending: true });

      if (sheetId) query = query.eq("sheet_id", sheetId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DREPeriod[];
    },
    enabled: !!session,
  });

  // Selected period managed externally, but provide helper
  const periodOptions = (periods || []).map(p => ({
    key: p.period_key,
    label: p.period_label || p.period_key,
    id: p.id,
    validationStatus: p.validation_status,
  }));

  // Fetch lines for a specific period
  function useLines(periodId?: string) {
    return useQuery({
      queryKey: ["dre-lines-v2", periodId],
      queryFn: async () => {
        if (!periodId) return [];
        const { data, error } = await supabase
          .from("dre_lines")
          .select("*")
          .eq("period_id", periodId)
          .order("order_index", { ascending: true });
        if (error) throw error;
        return (data || []) as DRELine[];
      },
      enabled: !!session && !!periodId,
    });
  }

  // Sync mutation
  const syncDRE = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke("dre-sync", {
        body: { connection_id: connectionId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dre-periods-v2"] });
      queryClient.invalidateQueries({ queryKey: ["dre-lines-v2"] });
      if (data.success) {
        toast({
          title: "DRE sincronizada",
          description: `${data.lines_count} linhas importadas em ${data.periods_count} períodos da aba "${data.tab_name}".`,
        });
      } else if (!data.found) {
        toast({
          title: "Aba DRE não encontrada",
          description: data.message || "Crie uma aba chamada 'DRE' na planilha.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Problema na importação",
          description: data.message || "Verifique o formato da aba DRE.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao sincronizar DRE",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // KPI calculator from lines
  function calculateKPIs(lines: DRELine[]) {
    const findSubtotal = (keyword: string) =>
      lines.find(l => l.is_subtotal && normalize(l.line_label).includes(keyword));

    const findGroupLine = (keyword: string) =>
      lines.find(l => l.is_group && normalize(l.line_label).includes(keyword));

    const getGroupItemsSum = (groupKeyword: string) => {
      const items = lines.filter(
        l => l.group_label && normalize(l.group_label).includes(groupKeyword) && !l.is_group && !l.is_subtotal
      );
      return items.reduce((sum, l) => sum + l.value, 0);
    };

    // Faturamento
    const fatGroup = findGroupLine("faturamento");
    const faturamento = fatGroup && fatGroup.value !== 0
      ? fatGroup.value
      : getGroupItemsSum("faturamento");

    // Receita Liquida
    const recLiqLine = findSubtotal("receita liquida");
    const receitaLiquida = recLiqLine
      ? recLiqLine.value
      : faturamento + getGroupItemsSum("deducoe");

    // Despesas Totais
    const despTotalLine = findSubtotal("despesas totais") || findSubtotal("total despesas");
    const despesasTotais = despTotalLine
      ? despTotalLine.value
      : getGroupItemsSum("despesa");

    // Resultado do Mes
    const resultadoLine = findSubtotal("resultado");
    const resultado = resultadoLine
      ? resultadoLine.value
      : receitaLiquida + despesasTotais; // despesas are negative

    // Margem Liquida
    const margemLiquida = receitaLiquida !== 0
      ? (resultado / receitaLiquida) * 100
      : null;

    return { faturamento, receitaLiquida, despesasTotais, resultado, margemLiquida };
  }

  const hasData = (periods || []).length > 0;

  return {
    periods,
    periodOptions,
    isLoadingPeriods,
    useLines,
    syncDRE,
    calculateKPIs,
    hasData,
  };
}
