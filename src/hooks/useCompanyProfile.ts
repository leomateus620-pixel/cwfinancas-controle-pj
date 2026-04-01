import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface CompanyProfile {
  id: string;
  user_id: string;
  connection_id: string | null;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  setor: string | null;
  porte: string | null;
  regime_tributario: string | null;
  num_funcionarios: number | null;
  faturamento_anual: number | null;
  cidade: string | null;
  estado: string | null;
  ano_fundacao: number | null;
  meta_receita_mensal: number | null;
  meta_despesa_mensal: number | null;
  meta_lucro_mensal: number | null;
  cnpj_lookup_source: string | null;
  cnpj_lookup_at: string | null;
  locally_edited_fields: string[] | null;
  created_at: string;
  updated_at: string;
}

export type CompanyProfileInput = Omit<CompanyProfile, "id" | "user_id" | "created_at" | "updated_at" | "connection_id" | "cnpj_lookup_source" | "cnpj_lookup_at" | "locally_edited_fields">;

export function useCompanyProfile(connectionId?: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: company, isLoading, error } = useQuery({
    queryKey: ["company-profile", user?.id, connectionId],
    queryFn: async () => {
      if (!user?.id) return null;

      // If connectionId provided, query with isolation
      if (connectionId) {
        const { data, error } = await supabase
          .from("company_profiles")
          .select("*")
          .eq("user_id", user.id)
          .eq("connection_id", connectionId)
          .maybeSingle();
        if (error) throw error;
        return data as CompanyProfile | null;
      }

      // Fallback: query without connection filter (backward compat)
      const { data, error } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CompanyProfile | null;
    },
    enabled: !!user?.id,
  });

  const upsertCompany = useMutation({
    mutationFn: async (input: Partial<CompanyProfileInput> & {
      cnpj_lookup_source?: string | null;
      cnpj_lookup_at?: string | null;
      locally_edited_fields?: string[] | null;
    }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const filter: any = { user_id: user.id };
      if (connectionId) filter.connection_id = connectionId;

      const { data: existing } = await supabase
        .from("company_profiles")
        .select("id")
        .match(filter)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("company_profiles")
          .update(input)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("company_profiles")
          .insert({
            ...input,
            user_id: user.id,
            connection_id: connectionId ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-profile", user?.id, connectionId] });
      toast({ title: "Dados salvos", description: "Perfil da empresa atualizado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
    },
  });

  return { company, isLoading, error, upsertCompany };
}
