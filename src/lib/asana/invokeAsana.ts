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
    const { data, error } = await supabase.functions.invoke(fn, { body });

    if (error) {
      const raw = (error as { message?: string })?.message ?? String(error);
      return { ok: false, error: friendly(raw), detail: raw };
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
