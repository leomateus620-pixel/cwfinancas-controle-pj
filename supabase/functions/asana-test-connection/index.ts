import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ASANA_PAT = Deno.env.get("ASANA_PAT");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "Não autenticado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes } = await authClient.auth.getUser(token);
    if (!userRes?.user) {
      return new Response(JSON.stringify({ ok: false, error: "Sessão inválida" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // permissão admin/manager
    const { data: roles } = await authClient.from("user_roles")
      .select("role").eq("user_id", userRes.user.id);
    const isInternal = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "manager");
    if (!isInternal) {
      return new Response(JSON.stringify({ ok: false, error: "Apenas administradores" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ASANA_PAT) {
      return new Response(JSON.stringify({ ok: false, error: "ASANA_PAT não configurado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://app.asana.com/api/1.0/users/me", {
      headers: { Authorization: `Bearer ${ASANA_PAT}`, Accept: "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: data?.errors?.[0]?.message ?? `Asana ${res.status}`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: true,
      user: { gid: data.data?.gid, name: data.data?.name, email: data.data?.email },
      workspaces: (data.data?.workspaces ?? []).map((w: { gid: string; name: string }) => ({
        gid: w.gid, name: w.name,
      })),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
