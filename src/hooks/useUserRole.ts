import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "manager" | "user" | "cliente";

export function useUserRole() {
  const { user } = useAuth();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data?.map((r) => r.role as AppRole) ?? [];
    },
    enabled: !!user?.id,
  });

  const hasRole = (role: AppRole) => roles?.includes(role) ?? false;
  const isAdmin = hasRole("admin");
  const isManager = hasRole("manager") || isAdmin;
  const isClient = hasRole("cliente");

  return {
    roles: roles ?? [],
    isLoading,
    hasRole,
    isAdmin,
    isManager,
    isClient,
  };
}
