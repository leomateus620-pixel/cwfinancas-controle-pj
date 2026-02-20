import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";


export interface DREPeriod {
  id: string;
  user_id: string;
  sheet_id: string | null;
  period_key: string;
  period_label: string | null;
  col_index: number | null;
  validation_status: string;
  validation_notes: string[];
  last_import_at: string;
  template_type: string;
}

export interface DRELine {
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
  nucleo: string | null;
  section: string | null;
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function useDRE(sheetId?: string) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const periodOptions = (periods || [])
    .map(p => ({
      key: p.period_key,
      label: p.period_label || p.period_key,
      id: p.id,
      validationStatus: p.validation_status,
      templateType: p.template_type || "DEFAULT",
    }));

  // Detect active template from periods
  const activeTemplate = (periods || []).length > 0
    ? (periods![0].template_type || "DEFAULT")
    : "DEFAULT";

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
        const templateLabel = data.template === "LCF_NUCLEO" ? "LCF por Núcleo" : "padrão";
        toast({
          title: "DRE sincronizada",
          description: `${data.lines_count} linhas importadas em ${data.periods_count} períodos (formato ${templateLabel}).`,
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

  function calculateKPIs(lines: DRELine[], viewMode: "consolidated" | "by_nucleo" = "consolidated") {
    const filtered = viewMode === "consolidated"
      ? lines.filter(l => l.nucleo === null)
      : lines;

    // For DEFAULT template, use original logic
    if (activeTemplate === "DEFAULT") {
      return calculateDefaultKPIs(filtered);
    }

    // LCF template KPIs (consolidated lines only for KPIs)
    const consolidatedLines = lines.filter(l => l.nucleo === null);
    return calculateLcfKPIs(consolidatedLines);
  }

  function calculateDefaultKPIs(lines: DRELine[]) {
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

    const fatGroup = findGroupLine("faturamento");
    const faturamento = fatGroup && fatGroup.value !== 0
      ? fatGroup.value
      : getGroupItemsSum("faturamento");

    const recLiqLine = findSubtotal("receita liquida");
    const receitaLiquida = recLiqLine
      ? recLiqLine.value
      : faturamento + getGroupItemsSum("deducoe");

    const despTotalLine = findSubtotal("despesas totais") || findSubtotal("total despesas");
    const despesasTotais = despTotalLine
      ? despTotalLine.value
      : getGroupItemsSum("despesa");

    const resultadoLine = findSubtotal("resultado");
    const resultado = resultadoLine
      ? resultadoLine.value
      : receitaLiquida + despesasTotais;

    const margemLiquida = receitaLiquida !== 0
      ? (resultado / receitaLiquida) * 100
      : null;

    return { faturamento, receitaLiquida, despesasTotais, resultado, margemLiquida };
  }

  function calculateLcfKPIs(lines: DRELine[]) {
    const findBySection = (section: string) =>
      lines.find(l => l.section === section && l.is_subtotal);

    const receitaBruta = findBySection("RECEITA_BRUTA");
    const despesasNucleo = findBySection("DESPESAS_NUCLEO");
    const despesasEscritorio = findBySection("DESPESAS_ESCRITORIO");
    const resultado = findBySection("RESULTADO_FINAL") || findBySection("RESULTADO");

    const faturamento = receitaBruta?.value ?? 0;
    const despesasTotais = (despesasNucleo?.value ?? 0) + (despesasEscritorio?.value ?? 0);
    const receitaLiquida = faturamento; // In LCF, receita bruta = receita líquida
    const resultadoVal = resultado?.value ?? (faturamento + despesasTotais);

    const margemLiquida = faturamento !== 0
      ? (resultadoVal / faturamento) * 100
      : null;

    return { faturamento, receitaLiquida, despesasTotais, resultado: resultadoVal, margemLiquida };
  }

  // Get unique nucleos from lines
  function getNucleos(lines: DRELine[]): string[] {
    const set = new Set<string>();
    lines.forEach(l => { if (l.nucleo) set.add(l.nucleo); });
    return Array.from(set).sort();
  }

  const hasData = (periods || []).length > 0;

  return {
    periods,
    periodOptions,
    isLoadingPeriods,
    useLines,
    syncDRE,
    calculateKPIs,
    getNucleos,
    hasData,
    activeTemplate,
  };
}
