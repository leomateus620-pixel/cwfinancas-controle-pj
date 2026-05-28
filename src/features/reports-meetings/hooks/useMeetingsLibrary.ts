import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteCloudMeeting,
  getCloudMeetingDetail,
  listCloudMeetings,
  requestEnhancedSummary,
  type MeetingDetailRow,
  type MeetingRow,
} from "../lib/meetingCloudRepository";

export type MeetingLibraryItem = MeetingRow;
export type MeetingLibraryDetail = MeetingDetailRow;

export function useMeetingsLibrary() {
  return useQuery({
    queryKey: ["meetings-library"],
    queryFn: async () => {
      try {
        return await listCloudMeetings(30);
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[meetings-library] list failed", e);
        throw new Error("Não foi possível carregar o histórico agora.");
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function useMeetingDetail(id: string | null) {
  return useQuery({
    queryKey: ["meeting-detail", id],
    enabled: Boolean(id),
    queryFn: async () => (id ? getCloudMeetingDetail(id) : null),
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCloudMeeting(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings-library"] }),
  });
}

export function useRegenerateSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await requestEnhancedSummary(id);
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["meetings-library"] });
      qc.invalidateQueries({ queryKey: ["meeting-detail", id] });
    },
  });
}
