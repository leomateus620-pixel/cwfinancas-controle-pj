import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MeetingLibraryItem {
  id: string;
  title: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  description: string | null;
  summary_generated_at: string | null;
  audio_purged_at: string | null;
}

export interface MeetingLibraryDetail extends MeetingLibraryItem {
  summary_markdown: string | null;
  action_items: string[] | null;
  decisions: string[] | null;
  mentioned_numbers: string[] | null;
}

export function useMeetingsLibrary() {
  return useQuery({
    queryKey: ["meetings-library"],
    queryFn: async (): Promise<MeetingLibraryItem[]> => {
      const { data, error } = await supabase.functions.invoke("reports-meetings-list", { body: {} });
      if (error) throw new Error(error.message || "Falha ao listar reuniões");
      return data?.meetings ?? [];
    },
    staleTime: 60_000,
  });
}

export function useMeetingDetail(id: string | null) {
  return useQuery({
    queryKey: ["meeting-detail", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<MeetingLibraryDetail | null> => {
      if (!id) return null;
      const { data, error } = await supabase.functions.invoke("reports-meetings-detail", {
        body: { meeting_session_id: id },
      });
      if (error) throw new Error(error.message || "Falha ao carregar reunião");
      return data?.meeting ?? null;
    },
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke("reports-meetings-delete", {
        body: { meeting_session_id: id },
      });
      if (error) throw new Error(error.message || "Falha ao excluir");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings-library"] }),
  });
}

export function useRegenerateSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke("reports-meetings-summarize", {
        body: { meeting_session_id: id },
      });
      if (error) throw new Error(error.message || "Falha ao gerar resumo");
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["meetings-library"] });
      qc.invalidateQueries({ queryKey: ["meeting-detail", id] });
    },
  });
}
