import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientUser {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
}

export function useClientUsers() {
  return useQuery({
    queryKey: ["client-users"],
    queryFn: async (): Promise<ClientUser[]> => {
      const { data, error } = await supabase
        .from("client_users")
        .select("id, user_id, username, display_name, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientUser[];
    },
  });
}

async function invoke<T = unknown>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json && json.ok === false)) {
    throw new Error(json?.error || `Falha (${res.status})`);
  }
  return json as T;
}

export function useCreateClientUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { username: string; password: string; display_name: string }) =>
      invoke<{ ok: true; username: string }>("create-client-user", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-users"] }),
  });
}

export function useResetClientPassword() {
  return useMutation({
    mutationFn: async (input: { client_user_id: string; password: string }) =>
      invoke<{ ok: true }>("reset-client-password", input),
  });
}

export function useToggleClientUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("client_users")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-users"] }),
  });
}
