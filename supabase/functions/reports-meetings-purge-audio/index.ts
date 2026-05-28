import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

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
    const meetingSessionId: string | undefined = body?.meeting_session_id;
    if (!meetingSessionId) {
      return new Response(JSON.stringify({ error: "meeting_session_id obrigatório" }), { status: 400, headers: corsHeaders });
    }

    const { data: session } = await supabase
      .from("meeting_sessions")
      .select("id, audio_chunks")
      .eq("id", meetingSessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!session) return new Response(JSON.stringify({ error: "Sessão não encontrada" }), { status: 404, headers: corsHeaders });

    const prefix = `${user.id}/${meetingSessionId}/audio`;
    const toRemove: string[] = Array.isArray(session.audio_chunks) ? [...session.audio_chunks] : [];

    // Also list the folder to catch chunks not tracked in the column
    try {
      const { data: listed } = await supabase.storage.from("meeting-reports").list(prefix, { limit: 1000 });
      if (Array.isArray(listed)) {
        for (const item of listed) {
          const full = `${prefix}/${item.name}`;
          if (!toRemove.includes(full)) toRemove.push(full);
        }
      }
    } catch {}

    let removed = 0;
    if (toRemove.length > 0) {
      const { data: rem } = await supabase.storage.from("meeting-reports").remove(toRemove);
      removed = Array.isArray(rem) ? rem.length : 0;
    }

    await supabase
      .from("meeting_sessions")
      .update({
        audio_chunks: [],
        audio_storage_path: null,
        audio_purged_at: new Date().toISOString(),
      })
      .eq("id", meetingSessionId)
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ status: "ok", removed }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: corsHeaders });
  }
});
