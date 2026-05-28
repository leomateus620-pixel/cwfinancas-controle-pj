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
    const id: string | undefined = body?.meeting_session_id;
    if (!id) return new Response(JSON.stringify({ error: "meeting_session_id obrigatório" }), { status: 400, headers: corsHeaders });

    const { data, error } = await supabase
      .from("meeting_sessions")
      .select("id, title, status, started_at, ended_at, duration_seconds, description, summary_markdown, summary_generated_at, audio_purged_at, action_items, decisions, mentioned_numbers")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return new Response(JSON.stringify({ error: "Sessão não encontrada" }), { status: 404, headers: corsHeaders });

    return new Response(JSON.stringify({ meeting: data }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: corsHeaders });
  }
});
