import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DemandComment {
  id: string;
  demand_id: string;
  user_id: string;
  comment: string;
  visibility: "client" | "internal";
  created_at: string;
}

export function useDemandComments(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-comments", demandId],
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_demand_comments")
        .select("*")
        .eq("demand_id", demandId!)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as DemandComment[];
    },
    staleTime: 10_000,
  });
}

export function useAddDemandComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandId, comment, visibility }: { demandId: string; comment: string; visibility: "client" | "internal" }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Você precisa estar autenticado.");
      const { error } = await supabase
        .from("financial_demand_comments")
        .insert({ demand_id: demandId, user_id: uid, comment: comment.trim(), visibility });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["demand-comments", vars.demandId] });
      qc.invalidateQueries({ queryKey: ["demand-timeline", vars.demandId] });
    },
  });
}
