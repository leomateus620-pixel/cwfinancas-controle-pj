import { supabase } from "@/integrations/supabase/client";

export type AsanaInvokeResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; detail?: string };

const FRIENDLY_FALLBACK = "Não foi possível sincronizar agora. Tente novamente.";

function friendly(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("failed to send") || m.includes("failed to fetch") || m.includes("networkerror"))
    return FRIENDLY_FALLBACK;
  if (m.includes("não autenticado") || m.includes("sessão inválida"))
    return "Sessão expirada. Faça login novamente.";
  if (m.includes("sem permissão") || m.includes("apenas administradores"))
    return "Você não tem permissão para esta ação.";
  if (m.includes("asana não configurad") || m.includes("integração asana não configurada"))
    return "Integração Asana ainda não configurada.";
  if (m.includes("demanda não encontrada"))
    return "Demanda não encontrada.";
  return raw.length > 140 ? FRIENDLY_FALLBACK : raw;
}

/**
 * Helper centralizado para invocar Edge Functions do Asana.
 * Nunca lança. Sempre retorna { ok, ... } com mensagem amigável.
 */
export async function invokeAsana<T = unknown>(
  fn: "asana-create-task" | "asana-update-task" | "asana-retry-sync" | "asana-test-connection",
  body: Record<string, unknown> = {},
): Promise<AsanaInvokeResult<T>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      return { ok: false, error: "Sessão expirada. Faça login novamente.", detail: "missing_session" };
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const raw = data?.error ?? data?.message ?? `HTTP ${response.status}`;
      return { ok: false, error: friendly(String(raw)), detail: String(raw) };
    }

    // As funções sempre devolvem 200 com { ok: boolean, ... }
    if (data && typeof data === "object" && "ok" in data && (data as { ok: boolean }).ok === false) {
      const raw = (data as { error?: string }).error ?? "Erro desconhecido";
      return { ok: false, error: friendly(raw), detail: raw };
    }

    return { ok: true, data: data as T };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: friendly(raw), detail: raw };
  }
}
