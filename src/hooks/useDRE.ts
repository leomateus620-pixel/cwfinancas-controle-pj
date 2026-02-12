import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type LineKey =
  | "REVENUE_GROSS" | "TAXES" | "REVENUE_NET" | "COGS" | "GROSS_PROFIT"
  | "OPEX_TOTAL" | "OPEX_ADMIN" | "OPEX_SALES" | "OPEX_PAYROLL" | "OPEX_FINANCE" | "OPEX_OTHER"
  | "EBITDA" | "OPERATING_INCOME" | "FIN_RESULT" | "PRE_TAX_INCOME" | "IR_CSLL" | "NET_INCOME";

interface DREValue {
  id: string;
  period_key: string;
  line_key: LineKey;
  value: number;
  source_tab: string | null;
  source_cell: string | null;
  source_label: string | null;
  is_calculated: boolean;
  original_value: number | null;
  sheet_id: string | null;
  updated_at: string;
}

interface DREMargins {
  grossMargin: number | null;
  ebitdaMargin: number | null;
  netMargin: number | null;
}

interface DRESyncResult {
  success: boolean;
  found: boolean;
  tab_name?: string;
  format?: string;
  periods?: string[];
  lines_mapped?: number;
  values_saved?: number;
  message?: string;
  error?: string;
}

export function useDRE(sheetId?: string, periodKey?: string) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch DRE values
  const {
    data: dreValues,
    isLoading: isLoadingValues,
    error: valuesError,
  } = useQuery({
    queryKey: ["dre-values", sheetId, periodKey],
    queryFn: async () => {
      let query = supabase
        .from("dre_values")
        .select("*")
        .order("line_key");

      if (sheetId) query = query.eq("sheet_id", sheetId);
      if (periodKey) query = query.eq("period_key", periodKey);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DREValue[];
    },
    enabled: !!session,
  });

  // Fetch available periods
  const {
    data: periods,
    isLoading: isLoadingPeriods,
  } = useQuery({
    queryKey: ["dre-periods", sheetId],
    queryFn: async () => {
      let query = supabase
        .from("dre_values")
        .select("period_key");

      if (sheetId) query = query.eq("sheet_id", sheetId);

      const { data, error } = await query;
      if (error) throw error;
      const uniquePeriods = [...new Set((data || []).map(d => d.period_key))];
      return uniquePeriods.sort().reverse();
    },
    enabled: !!session,
  });

  // Sync DRE mutation
  const syncDRE = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke("dre-sync", {
        body: { connection_id: connectionId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as DRESyncResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dre-values"] });
      queryClient.invalidateQueries({ queryKey: ["dre-periods"] });
      if (data.success) {
        toast({
          title: "DRE sincronizada",
          description: `${data.values_saved} valores importados da aba "${data.tab_name}".`,
        });
      } else if (!data.found) {
        toast({
          title: "Aba DRE não encontrada",
          description: data.message || "Crie uma aba chamada 'DRE' na planilha.",
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

  // Helper: get value for a specific line key
  const getValue = (key: LineKey): number | null => {
    const item = dreValues?.find(v => v.line_key === key);
    return item ? item.value : null;
  };

  // Helper: get DRE item with metadata
  const getItem = (key: LineKey): DREValue | null => {
    return dreValues?.find(v => v.line_key === key) || null;
  };

  // Calculate margins (frontend redundancy)
  const margins: DREMargins = (() => {
    const revenueNet = getValue("REVENUE_NET");
    if (!revenueNet || revenueNet === 0) {
      return { grossMargin: null, ebitdaMargin: null, netMargin: null };
    }
    const grossProfit = getValue("GROSS_PROFIT");
    const ebitda = getValue("EBITDA");
    const netIncome = getValue("NET_INCOME");
    return {
      grossMargin: grossProfit !== null ? (grossProfit / revenueNet) * 100 : null,
      ebitdaMargin: ebitda !== null ? (ebitda / revenueNet) * 100 : null,
      netMargin: netIncome !== null ? (netIncome / revenueNet) * 100 : null,
    };
  })();

  // Validation status: items with is_calculated=true and original_value different
  const divergences = (dreValues || []).filter(
    v => v.is_calculated && v.original_value !== null && Math.abs(v.value - v.original_value) > 1
  );

  const hasData = (dreValues || []).length > 0;

  return {
    dreValues,
    isLoadingValues,
    valuesError,
    periods,
    isLoadingPeriods,
    syncDRE,
    getValue,
    getItem,
    margins,
    divergences,
    hasData,
  };
}
