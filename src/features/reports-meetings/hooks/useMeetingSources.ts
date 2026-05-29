import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MeetingSource {
  id: string;
  spreadsheet_id: string;
  spreadsheet_name: string;
  sheet_name: string | null;
  data_type: string;
  updated_at: string;
  created_at: string;
  provider: "google_sheets" | "drive_xlsx" | "excel_upload";
  selected_tabs: string[];
}

const QUERY_KEY = ["meeting-sources"];

function parseTabs(sheet_name: string | null): string[] {
  if (!sheet_name) return [];
  try {
    const parsed = JSON.parse(sheet_name);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string");
  } catch {
    // single name
  }
  return sheet_name.split("|").map((s) => s.trim()).filter(Boolean);
}

export function useMeetingSources() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const sourcesQuery = useQuery({
    queryKey: [...QUERY_KEY, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<MeetingSource[]> => {
      const { data, error } = await supabase
        .from("google_sheet_connections")
        .select("id, spreadsheet_id, spreadsheet_name, sheet_name, data_type, updated_at, created_at")
        .eq("user_id", user!.id)
        .eq("purpose", "meetings")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => {
        const provider: MeetingSource["provider"] =
          row.data_type === "excel_upload"
            ? "excel_upload"
            : row.data_type === "drive_xlsx"
              ? "drive_xlsx"
              : "google_sheets";
        return {
          ...row,
          provider,
          selected_tabs: parseTabs(row.sheet_name),
        };
      });
    },
  });

  const connectSheet = useMutation({
    mutationFn: async (input: {
      spreadsheet_id: string;
      spreadsheet_name: string;
      selected_tabs: string[];
      provider?: "google_sheets" | "drive_xlsx" | "excel_upload";
    }) => {
      if (!user?.id) throw new Error("Sessão não encontrada.");
      const provider = input.provider ?? "google_sheets";
      const dataType =
        provider === "excel_upload" ? "excel_upload" : provider === "drive_xlsx" ? "drive_xlsx" : "google_sheets";
      const { data, error } = await supabase
        .from("google_sheet_connections")
        .insert({
          user_id: user.id,
          spreadsheet_id: input.spreadsheet_id,
          spreadsheet_name: input.spreadsheet_name,
          sheet_name: JSON.stringify(input.selected_tabs),
          data_type: dataType,
          purpose: "meetings",
          sync_frequency: "manual",
          sync_status: "ready",
          refresh_token: "managed_by_oauth_table",
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const disconnectSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("google_sheet_connections")
        .delete()
        .eq("id", id)
        .eq("purpose", "meetings");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    sources: sourcesQuery.data ?? [],
    isLoading: sourcesQuery.isLoading,
    error: sourcesQuery.error as Error | null,
    connectSheet,
    disconnectSource,
    refetch: sourcesQuery.refetch,
  };
}
