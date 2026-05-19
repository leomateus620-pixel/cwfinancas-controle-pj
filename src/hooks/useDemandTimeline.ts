import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TimelineEvent {
  id: string;
  demand_id: string;
  event_type: string;
  title: string;
  description: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useDemandTimeline(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-timeline", demandId],
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_demand_timeline")
        .select("*")
        .eq("demand_id", demandId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as TimelineEvent[];
    },
    staleTime: 10_000,
  });
}
