import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (new URL(req.url).searchParams.get("health") === "1") return ok({ ok: true, function: "reports-meetings-list", project_id: new URL(url).host.split(".")[0], timestamp: new Date().toISOString() });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return ok({ error: "JWT obrigatório" }, 401);
    if (!service) return ok({ error: "SUPABASE_SERVICE_ROLE_KEY ausente na Edge Function" }, 500);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);
    const { data: u } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!u.user) return ok({ error: "Usuário não autenticado" }, 401);
    const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? "30"), 100);
    const { data, error } = await admin.from("meeting_sessions").select("id, title, status, cloud_status, started_at, ended_at, duration_seconds, description, summary_status, summary_generated_at, audio_purged_at, last_autosave_at").eq("user_id", u.user.id).order("started_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return ok({ ok: true, meetings: data ?? [] });
  } catch (e) { return ok({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
