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
      if (yearA !== yearB) return yearB.localeCompare(yearA);
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

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const p of sortedPeriods) {
      const match = p.period_key.match(/^(\d{4})/);
      if (match) years.add(parseInt(match[1]));
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [sortedPeriods]);

  const availableScenarios = useMemo(() => {
    const scenarios = new Set<string>();
    for (const p of sortedPeriods) {
      const s = (p as any).scenario;
      if (s) scenarios.add(s);
    }
    return Array.from(scenarios);
  }, [sortedPeriods]);

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
        title: "Não foi possível sincronizar agora",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    },
  });

  /**
   * ROBUST KPI CALCULATION — tries multiple strategies to find each KPI value:
   * 1. Find as subtotal line (is_subtotal + keyword match)
   * 2. Find as group line with non-zero value (is_group + keyword match)
   * 3. Find ANY line with keyword match (fallback)
   * 4. Sum children under group (last resort)
   */
  function calculateKPIs(lines: DRELine[], viewMode: "consolidated" | "by_nucleo" = "consolidated") {
    const filtered = viewMode === "consolidated"
      ? lines.filter(l => l.nucleo === null)
      : lines;

    if (activeTemplate === "LCF_NUCLEO") {
      const consolidatedLines = lines.filter(l => l.nucleo === null);
      return calculateLcfKPIs(consolidatedLines);
    }

    return calculateDefaultKPIs(filtered);
  }

  function findLineValue(lines: DRELine[], keyword: string): number | null {
    // Strategy 1: subtotal line with keyword
    const subtotal = lines.find(l => l.is_subtotal && normalize(l.line_label).includes(keyword));
    if (subtotal && subtotal.value !== 0) return subtotal.value;

    // Strategy 2: group line with non-zero value
    const group = lines.find(l => l.is_group && normalize(l.line_label).includes(keyword));
    if (group && group.value !== 0) return group.value;

    // Strategy 3: any line where label starts with/equals the keyword (exact match preferred)
    const exact = lines.find(l => {
      const n = normalize(l.line_label);
      return n === keyword || n.startsWith(keyword + " ") || n.startsWith(keyword + ":");
    });
    if (exact && exact.value !== 0) return exact.value;

    // Strategy 4: subtotal with value 0 (legitimate zero)
    if (subtotal) return subtotal.value;
    if (group) return group.value;

    // Strategy 5: sum children under group
    const children = lines.filter(
      l => l.group_label && normalize(l.group_label).includes(keyword) && !l.is_group && !l.is_subtotal
    );
    if (children.length > 0) {
      return children.reduce((sum, l) => sum + l.value, 0);
    }

    return null;
  }

  function calculateDefaultKPIs(lines: DRELine[]) {
    // Extract all DRE components individually
    const faturamento = findLineValue(lines, "faturamento")
      ?? findLineValue(lines, "receita bruta")
      ?? 0;

    const deducoes = findLineValue(lines, "deducoe")
      ?? findLineValue(lines, "deducao")
      ?? findLineValue(lines, "impostos sobre")
      ?? 0;

    const cmv = findLineValue(lines, "cmv")
      ?? findLineValue(lines, "custo mercadoria")
      ?? 0;

    const custoDeVenda = findLineValue(lines, "custo de venda")
      ?? findLineValue(lines, "custos de venda")
      ?? 0;

    const receitaLiquida = findLineValue(lines, "receita liquida")
      ?? (faturamento + deducoes);

    const despesasTotais = findLineValue(lines, "despesas totais")
      ?? findLineValue(lines, "total despesas")
      ?? (() => {
        const despChildren = lines.filter(
          l => l.group_label && normalize(l.group_label).includes("despesa") && !l.is_group && !l.is_subtotal
        );
        return despChildren.length > 0 ? despChildren.reduce((sum, l) => sum + l.value, 0) : 0;
      })();

    const lucroOperacional = findLineValue(lines, "lucro operacional")
      ?? findLineValue(lines, "resultado operacional")
      ?? null;

    const distribuicao = findLineValue(lines, "distribuicao")
      ?? findLineValue(lines, "distribuicoes")
      ?? findLineValue(lines, "pro-labore")
      ?? 0;

    const resultado = findLineValue(lines, "resultado do exercicio")
      ?? findLineValue(lines, "resultado exercicio")
      ?? findLineValue(lines, "resultado")
      ?? findLineValue(lines, "lucro liquido")
      ?? lucroOperacional
      ?? (receitaLiquida + despesasTotais);

    // Compute totalSaiu = faturamento - resultado (guarantees Entrou - Saiu = Sobrou)
    const totalSaiu = faturamento - resultado;

    // Margem
    const margemLiquida = faturamento !== 0
      ? (resultado / faturamento) * 100
      : null;

    // Consistency check
    const isConsistent = Math.abs(resultado - (receitaLiquida + despesasTotais)) <= 0.01 || despesasTotais === 0;

    return {
      faturamento, receitaLiquida, despesasTotais, resultado,
      margemLiquida, isConsistent,
      deducoes, cmv, custoDeVenda, lucroOperacional, distribuicao, totalSaiu,
    };
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

    const isConsistent = Math.abs(resultadoVal - (faturamento + despesasTotais)) <= 0.01 || despesasTotais === 0;

    return { faturamento, receitaLiquida, despesasTotais, resultado: resultadoVal, margemLiquida, isConsistent };
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
