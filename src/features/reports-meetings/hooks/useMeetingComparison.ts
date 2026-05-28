import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMeetingComparison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { pre_report_id: string; meeting_session_id: string }) => {
      const { data, error } = await supabase.functions.invoke("reports-meetings-compare", { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting-comparisons"] }),
  });
}
