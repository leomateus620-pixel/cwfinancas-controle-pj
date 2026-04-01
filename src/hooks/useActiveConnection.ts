import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useActiveConnection() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["active-connection", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("google_sheet_connections")
        .select("id, spreadsheet_name, spreadsheet_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  return {
    connectionId: data?.id ?? null,
    spreadsheetName: data?.spreadsheet_name ?? null,
    spreadsheetId: data?.spreadsheet_id ?? null,
    isLoading,
  };
}
