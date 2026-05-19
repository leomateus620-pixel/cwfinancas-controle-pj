import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function invoke(fn: string, demand_id: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ demand_id }),
  });
  return res.json().catch(() => ({ ok: false }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const demand_id: string | undefined = body?.demand_id;

    const cronSecret = req.headers.get("x-cron-secret");
    const isCron = cronSecret && cronSecret === Deno.env.get("CRON_SECRET");
    if (!isCron && !demand_id) {
      // chamada manual sem id exige auth
      const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      if (!token) return new Response(JSON.stringify({ ok: false, error: "Não autenticado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: ures } = await auth.auth.getUser(token);
      if (!ures?.user) return new Response(JSON.stringify({ ok: false, error: "Sessão inválida" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", ures.user.id);
      const isInternal = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "manager");
      if (!isInternal) return new Response(JSON.stringify({ ok: false, error: "Sem permissão" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (demand_id) {
      const { data: d } = await svc.from("financial_demands")
        .select("id,asana_task_id").eq("id", demand_id).maybeSingle();
      if (!d) return new Response(JSON.stringify({ ok: false, error: "Demanda não encontrada" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const fn = d.asana_task_id ? "asana-update-task" : "asana-create-task";
      await svc.from("financial_demands").update({
        asana_sync_status: "pending_sync", asana_sync_error: null,
      }).eq("id", demand_id);
      const r = await invoke(fn, demand_id);
      return new Response(JSON.stringify({ ok: true, processed: 1, result: r }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // batch
    const { data: rows } = await svc.from("financial_demands")
      .select("id,asana_task_id,asana_sync_status")
      .in("asana_sync_status", ["pending_sync", "error"])
      .order("updated_at", { ascending: true })
      .limit(50);

    let success = 0, errors = 0;
    for (const row of (rows ?? [])) {
      const fn = row.asana_task_id ? "asana-update-task" : "asana-create-task";
      const r = await invoke(fn, row.id);
      if (r?.ok) success++; else errors++;
    }

    return new Response(JSON.stringify({
      ok: true, processed: rows?.length ?? 0, success, errors,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
