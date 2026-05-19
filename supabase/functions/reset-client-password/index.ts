// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad("Method not allowed", 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return bad("Não autenticado", 401);

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) return bad("Sessão inválida", 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isInternal = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "manager");
    if (!isInternal) return bad("Sem permissão", 403);

    const body = await req.json().catch(() => ({}));
    const client_user_id = String(body.client_user_id ?? "");
    const password = String(body.password ?? "");
    if (!client_user_id) return bad("client_user_id obrigatório");
    if (password.length < 6) return bad("Senha deve ter ao menos 6 caracteres");

    const { data: cu } = await admin
      .from("client_users")
      .select("user_id")
      .eq("id", client_user_id)
      .maybeSingle();
    if (!cu?.user_id) return bad("Cliente não encontrado", 404);

    const { error: updErr } = await admin.auth.admin.updateUserById(cu.user_id, { password });
    if (updErr) return bad(updErr.message, 500);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return bad((e as Error)?.message ?? "Erro", 500);
  }
});
