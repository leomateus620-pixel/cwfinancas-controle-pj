import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const ok = (b: unknown, s=200) => new Response(JSON.stringify(b), {status:s, headers:corsHeaders});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "JWT obrigatório" }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: u } = await supabase.auth.getUser(token);
    const user = u.user;
    if (!user) return new Response(JSON.stringify({ error: "Usuário não autenticado" }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const id: string | undefined = body?.meeting_session_id;
    if (!id) return new Response(JSON.stringify({ error: "meeting_session_id obrigatório" }), { status: 400, headers: corsHeaders });

    // Remove audio files (best effort)
    try {
      const prefix = `${user.id}/${id}/audio`;
      const { data: listed } = await supabase.storage.from("meeting-reports").list(prefix, { limit: 1000 });
      if (Array.isArray(listed) && listed.length > 0) {
        await supabase.storage.from("meeting-reports").remove(listed.map((it) => `${prefix}/${it.name}`));
      }
    } catch {}

    const { error } = await supabase
      .from("meeting_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    return new Response(JSON.stringify({ status: "ok" }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: corsHeaders });
  }
});
