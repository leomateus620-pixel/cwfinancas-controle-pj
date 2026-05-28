import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useReportsMeetings() {
  const reports = useQuery({
    queryKey: ["pre-meeting-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pre_meeting_reports").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const meetings = useQuery({
    queryKey: ["meeting-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_sessions").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  return { reports, meetings };
}
