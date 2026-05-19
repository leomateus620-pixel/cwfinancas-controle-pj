import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePendingApprovalsCount(enabled = true) {
  return useQuery({
    queryKey: ["demands-pending-count"],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("financial_demands")
        .select("id", { head: true, count: "exact" })
        .eq("status", "aguardando_aprovacao");
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
