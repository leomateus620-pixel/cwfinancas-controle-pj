import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  preferences: Json | null;
  created_at: string;
  updated_at: string;
}

export type ProfileInput = Pick<Profile, "full_name" | "company_name" | "avatar_url"> & {
  preferences?: Json;
};

export function useProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user?.id,
  });

  const updateProfile = useMutation({
    mutationFn: async (input: Partial<ProfileInput>) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("profiles")
        .update(input)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar perfil",
        description: error.message,
      });
    },
  });

  return {
    profile,
    isLoading,
    error,
    updateProfile,
  };
}
