import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface CompanyProfile {
  id: string;
  user_id: string;
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
  created_at: string;
  updated_at: string;
}

export type CompanyProfileInput = Omit<CompanyProfile, "id" | "user_id" | "created_at" | "updated_at">;

export function useCompanyProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: company, isLoading, error } = useQuery({
    queryKey: ["company-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as CompanyProfile | null;
    },
    enabled: !!user?.id,
  });

  const upsertCompany = useMutation({
    mutationFn: async (input: Partial<CompanyProfileInput>) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data: existing } = await supabase
        .from("company_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("company_profiles")
          .update(input)
          .eq("user_id", user.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("company_profiles")
          .insert({ ...input, user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-profile"] });
      toast({ title: "Dados salvos", description: "Perfil da empresa atualizado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
    },
  });

  return { company, isLoading, error, upsertCompany };
}
