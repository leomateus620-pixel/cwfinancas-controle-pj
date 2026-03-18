import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ColumnMapping {
  date?: string;
  description?: string;
  amount?: string;
  category?: string;
  type?: string;
  credit?: string;
  debit?: string;
  client_vendor?: string;
  account?: string;
}

export interface ParsingRules {
  date_format: string;
  currency: string;
  negative_formats: string[];
  decimal_separator: string;
}

export interface SkipPattern {
  type: "keyword" | "row_pattern";
  value?: string;
  description?: string;
}

export interface SheetProfile {
  profile_id: string | null;
  header_signature: string;
  column_mapping: ColumnMapping;
  parsing_rules: ParsingRules;
  skip_patterns: SkipPattern[];
  confidence: number;
  from_cache: boolean;
}

interface UseSheetProfileOptions {
  connectionId: string;
  tabName?: string;
  enabled?: boolean;
}

export function useSheetProfile({ connectionId, tabName, enabled = true }: UseSheetProfileOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery<SheetProfile>({
    queryKey: ["sheet-profile", connectionId, tabName],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-profile-sheet", {
        body: { connectionId, tabName },
      });

      if (error) throw error;
      // Treat "Connection not found" as empty profile, not a crash
      if (data?.error === "Connection not found") return null;
      if (data?.error) throw new Error(data.error);

      return data as SheetProfile;
    },
    enabled: enabled && !!connectionId,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });

  const revalidateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-profile-sheet", {
        body: { connectionId, tabName, forceRefresh: true },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as SheetProfile;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["sheet-profile", connectionId, tabName], data);
      toast({
        title: "Perfil atualizado",
        description: `Confiança: ${Math.round(data.confidence * 100)}%`,
      });
    },
    onError: (error) => {
      console.error("Error revalidating profile:", error);
      toast({
        title: "Erro ao revalidar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  return {
    profile,
    isLoading,
    error,
    refetch,
    revalidate: revalidateMutation.mutate,
    isRevalidating: revalidateMutation.isPending,
  };
}
