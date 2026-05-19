import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AsanaSettings {
  id?: string;
  is_enabled: boolean;
  workspace_gid: string | null;
  project_gid: string | null;
  default_section_gid: string | null;
  default_assignee_gid: string | null;
  status_mapping: Record<string, string>;
  priority_mapping: Record<string, string>;
}

export function useAsanaSettings() {
  return useQuery({
    queryKey: ["asana-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asana_integration_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw new Error(error.message);
      return (data ?? null) as AsanaSettings | null;
    },
    staleTime: 30_000,
  });
}

export function useSaveAsanaSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AsanaSettings) => {
      if (input.id) {
        const { error } = await supabase.from("asana_integration_settings")
          .update(input).eq("id", input.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("asana_integration_settings").insert(input);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asana-settings"] }),
  });
}
