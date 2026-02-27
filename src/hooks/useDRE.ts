import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";

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
  scenario?: string | null;
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

  // Sort periods: 2026 > 2025 > 2024, TOTAL last within each year
  const sortedPeriods = useMemo(() => {
    if (!periods) return [];
    return [...periods].sort((a, b) => {
      const yearA = a.period_key.match(/^(\d{4})/)?.[1] || "0000";
      const yearB = b.period_key.match(/^(\d{4})/)?.[1] || "0000";
      // Higher year first
      if (yearA !== yearB) return yearB.localeCompare(yearA);
      // TOTAL at the beginning of each year group
      const isTotalA = a.period_key.includes("TOTAL");
      const isTotalB = b.period_key.includes("TOTAL");
      if (isTotalA && !isTotalB) return -1;
      if (!isTotalA && isTotalB) return 1;
      return a.period_key.localeCompare(b.period_key);
    });
  }, [periods]);

  const periodOptions = sortedPeriods.map(p => ({
    key: p.period_key,
    label: p.period_label || p.period_key,
    id: p.id,
    validationStatus: p.validation_status,
    templateType: p.template_type || "DEFAULT",
    scenario: (p as any).scenario as string | null,
  }));

  // Available years (sorted desc: 2026, 2025, 2024)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const p of sortedPeriods) {
      const match = p.period_key.match(/^(\d{4})/);
      if (match) years.add(parseInt(match[1]));
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [sortedPeriods]);

  // Available scenarios (for SAH model)
  const availableScenarios = useMemo(() => {
    const scenarios = new Set<string>();
    for (const p of sortedPeriods) {
      const s = (p as any).scenario;
      if (s) scenarios.add(s);
    }
    return Array.from(scenarios);
  }, [sortedPeriods]);

  // Derive activeTemplate from ALL periods (most frequent template wins)
  const activeTemplate = useMemo(() => {
    if (!sortedPeriods || sortedPeriods.length === 0) return "DEFAULT";
    const counts = new Map<string, number>();
    for (const p of sortedPeriods) {
      const t = p.template_type || "DEFAULT";
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    let best = "DEFAULT";
    let bestCount = 0;
    for (const [t, c] of counts) {
      if (c > bestCount) { best = t; bestCount = c; }
    }
    return best;
  }, [sortedPeriods]);

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
        const models = data.models_detected?.map((m: any) => `${m.tab}(${m.model})`).join(", ") || "";
        toast({
          title: "DRE sincronizada",
          description: `${data.lines_count} linhas em ${data.periods_count} períodos.${models ? ` Modelos: ${models}` : ""}`,
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

    if (activeTemplate === "DEFAULT" || activeTemplate === "SAH" || activeTemplate === "STARTSYNC" || activeTemplate === "GR") {
      return calculateDefaultKPIs(filtered);
    }

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

    const despTotalLine = findSubtotal("despesas totais") || findSubtotal("total despesas") || findSubtotal("gastos");
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
    const receitaLiquida = faturamento;
    const resultadoVal = resultado?.value ?? (faturamento + despesasTotais);

    const margemLiquida = faturamento !== 0
      ? (resultadoVal / faturamento) * 100
      : null;

    return { faturamento, receitaLiquida, despesasTotais, resultado: resultadoVal, margemLiquida };
  }

  function getNucleos(lines: DRELine[]): string[] {
    const set = new Set<string>();
    lines.forEach(l => { if (l.nucleo) set.add(l.nucleo); });
    return Array.from(set).sort();
  }

  const hasData = (periods || []).length > 0;

  return {
    periods: sortedPeriods,
    periodOptions,
    isLoadingPeriods,
    useLines,
    syncDRE,
    calculateKPIs,
    getNucleos,
    hasData,
    activeTemplate,
    availableYears,
    availableScenarios,
  };
}
