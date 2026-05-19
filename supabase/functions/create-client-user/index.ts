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

const CLIENT_EMAIL_DOMAIN = "cliente.cwfinancas.local";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "")
    .slice(0, 40);
}

function badRequest(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: false, error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return badRequest("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return badRequest("Não autenticado", 401);

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) return badRequest("Sessão inválida", 401);
    const caller = userData.user;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authorize: only admin / manager
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const isInternal = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "manager");
    if (!isInternal) return badRequest("Sem permissão para criar acesso de cliente", 403);

    const body = await req.json().catch(() => ({}));
    const username = slugify(String(body.username ?? "").trim());
    const password = String(body.password ?? "").trim();
    const display_name = String(body.display_name ?? "").trim() || username;

    if (username.length < 3) return badRequest("Usuário deve ter ao menos 3 caracteres");
    if (password.length < 6) return badRequest("Senha deve ter ao menos 6 caracteres");

    // Check duplicate
    const { data: existing } = await admin
      .from("client_users")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) return badRequest("Este usuário já existe");

    const email = `${username}@${CLIENT_EMAIL_DOMAIN}`;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "cliente",
        username,
        display_name,
        full_name: display_name,
        created_by: caller.id,
      },
    });
    if (createErr || !created?.user) {
      return badRequest(createErr?.message ?? "Falha ao criar usuário", 500);
    }

    // Trigger handle_new_user inserts client_users; ensure it ran with username/display
    await admin
      .from("client_users")
      .upsert(
        {
          user_id: created.user.id,
          username,
          display_name,
          created_by: caller.id,
          is_active: true,
        },
        { onConflict: "user_id" },
      );

    return new Response(
      JSON.stringify({ ok: true, username, display_name, user_id: created.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return badRequest((e as Error)?.message ?? "Erro inesperado", 500);
  }
});
