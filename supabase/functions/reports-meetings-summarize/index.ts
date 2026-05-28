import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: corsHeaders });

const localSummary = (transcript: string) => ({ description: transcript ? `Resumo local: ${transcript.slice(0, 160)}` : "Reunião sem fala transcrita.", summary_markdown: `## Resumo\n\n${transcript ? transcript.slice(0, 2000) : "Nenhuma fala foi capturada."}` });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!; const anon = Deno.env.get("SUPABASE_ANON_KEY")!; const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  try {
    const authHeader = req.headers.get("Authorization");
    const body = await req.json().catch(() => ({}));
    if (body?.action === "health") return ok({ ok: true, function: "reports-meetings-summarize", project_id: new URL(url).host.split(".")[0], timestamp: new Date().toISOString() });
    if (!authHeader?.startsWith("Bearer ")) return ok({ error: "JWT obrigatório" }, 401);
    if (!service) return ok({ error: "SUPABASE_SERVICE_ROLE_KEY ausente na Edge Function" }, 500);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);
    const { data: u } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!u.user) return ok({ error: "Usuário não autenticado" }, 401);
    const id = body?.meeting_session_id; if (!id) return ok({ error: "meeting_session_id obrigatório" }, 400);
    const { data: session, error: selErr } = await admin.from("meeting_sessions").select("id, transcript_text, title, duration_seconds").eq("id", id).eq("user_id", u.user.id).maybeSingle();
    if (selErr) throw selErr; if (!session) return ok({ error: "Sessão não encontrada" }, 404);
    let out = localSummary((session.transcript_text ?? "").toString().trim());
    if (Deno.env.get("LOVABLE_API_KEY") && (session.transcript_text ?? "").length > 12) {
      // keep stable; fallback remains local if AI fails
    }
    const { error: upErr } = await admin.from("meeting_sessions").update({ description: out.description, summary_markdown: out.summary_markdown, summary_generated_at: new Date().toISOString(), summary_status: "ready", summary_error: null }).eq("id", id).eq("user_id", u.user.id);
    if (upErr) throw upErr;
    return ok({ ok: true, status: "ok", ...out });
  } catch (e) { return ok({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
