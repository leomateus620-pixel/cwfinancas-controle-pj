import { FunctionsFetchError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type CloudErrorCode = "no_session" | "function_not_deployed" | "cors_or_network" | "unauthorized" | "schema_missing_column" | "missing_env" | "rls_denied" | "unknown";

const FUNCTIONS = ["reports-meetings-transcribe", "reports-meetings-list", "reports-meetings-detail", "reports-meetings-summarize", "reports-meetings-purge-audio", "reports-meetings-delete"] as const;

export function classifyFunctionError(error: unknown): CloudErrorCode {
  const msg = String((error as any)?.message ?? error ?? "").toLowerCase();
  if (msg.includes("jwt") || msg.includes("unauthorized") || msg.includes("401")) return "unauthorized";
  if (msg.includes("column") || msg.includes("schema") || msg.includes("does not exist")) return "schema_missing_column";
  if (msg.includes("service_role") || msg.includes("lovable_api_key") || msg.includes("ausente")) return "missing_env";
  if (msg.includes("rls") || msg.includes("permission denied") || msg.includes("42501")) return "rls_denied";
  if (msg.includes("failed to send") || msg.includes("network") || msg.includes("cors")) return "cors_or_network";
  if (msg.includes("not found") || msg.includes("404") || msg.includes("edge function returned") || msg.includes("non-2xx")) return "function_not_deployed";
  return "unknown";
}

export async function checkSupabaseSession() {
  const { data } = await supabase.auth.getSession();
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return {
    hasSession: Boolean(data.session),
    userId: data.session?.user?.id ?? null,
    projectHost: url ? new URL(url).host : "",
    commit: (import.meta.env.VITE_APP_COMMIT_SHA as string | undefined) ?? "dev",
  };
}

export async function checkFunctionHealth(functionName: (typeof FUNCTIONS)[number]) {
  const payload = functionName === "reports-meetings-list" ? undefined : { action: "health" };
  const query = functionName === "reports-meetings-list" ? "?health=1" : "";
  try {
    const { data, error } = await supabase.functions.invoke(`${functionName}${query}`, payload ? { body: payload } : undefined);
    if (error) throw error;
    return { ok: true, function: functionName, data };
  } catch (error) {
    const code = error instanceof FunctionsFetchError ? "cors_or_network" : classifyFunctionError(error);
    return { ok: false, function: functionName, code, error: String((error as any)?.message ?? error) };
  }
}

export async function runReportsMeetingsCloudDiagnostics() {
  const session = await checkSupabaseSession();
  const checks = await Promise.all(FUNCTIONS.map((fn) => checkFunctionHealth(fn)));
  return { session, checks, expectedFunctions: [...FUNCTIONS] };
}
