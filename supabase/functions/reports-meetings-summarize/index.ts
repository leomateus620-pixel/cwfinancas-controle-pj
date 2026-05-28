import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

async function callPurgeAudio(meetingSessionId: string, authHeader: string) {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/reports-meetings-purge-audio`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ meeting_session_id: meetingSessionId }),
    });
  } catch {}
}

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

    const { data: session, error: selErr } = await supabase
      .from("meeting_sessions")
      .select("id, transcript_text, title, duration_seconds, started_at")
      .eq("id", meetingSessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (selErr) throw selErr;
    if (!session) return new Response(JSON.stringify({ error: "Sessão não encontrada" }), { status: 404, headers: corsHeaders });

    const transcript = (session.transcript_text ?? "").toString().trim();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), { status: 500, headers: corsHeaders });
    }

    let description = "";
    let summaryMarkdown = "";

    if (transcript.length < 12) {
      description = "Reunião sem fala transcrita.";
      summaryMarkdown = "## Resumo\n\nNenhuma fala foi capturada nesta reunião.";
    } else {
      const system = `Você é um analista executivo. A partir da transcrição em português de uma reunião, gere:
1) "description": UMA frase objetiva de até 220 caracteres descrevendo do que tratou a reunião.
2) "summary_markdown": resumo estruturado em Markdown com as seções (use cabeçalhos ##):
   - Tópicos discutidos (lista)
   - Decisões tomadas (lista)
   - Ações e responsáveis (lista com formato "- Ação — Responsável (prazo se citado)")
   - Números e valores citados (lista, se houver)
   - Próximos passos (lista curta)

Responda EXCLUSIVAMENTE em JSON válido: {"description": "...", "summary_markdown": "..."}.
Não invente fatos. Se a transcrição for curta ou ambígua, indique isso textualmente.`;

      const user_prompt = `Título: ${session.title ?? "Reunião"}\nDuração: ${session.duration_seconds ?? 0}s\n\nTranscrição:\n"""\n${transcript.slice(0, 18000)}\n"""`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user_prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!aiRes.ok) {
        const t = await aiRes.text();
        return new Response(JSON.stringify({ error: `IA falhou: ${aiRes.status} ${t.slice(0, 200)}` }), { status: 502, headers: corsHeaders });
      }
      const aiJson = await aiRes.json();
      const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
      try {
        const parsed = JSON.parse(content);
        description = (parsed?.description ?? "").toString().slice(0, 240);
        summaryMarkdown = (parsed?.summary_markdown ?? "").toString();
      } catch {
        description = "Resumo gerado parcialmente.";
        summaryMarkdown = String(content).slice(0, 4000);
      }
    }

    const { error: upErr } = await supabase
      .from("meeting_sessions")
      .update({
        description,
        summary_markdown: summaryMarkdown,
        summary_generated_at: new Date().toISOString(),
      })
      .eq("id", meetingSessionId)
      .eq("user_id", user.id);
    if (upErr) throw upErr;

    // Fire purge after summary success
    await callPurgeAudio(meetingSessionId, authHeader);

    return new Response(JSON.stringify({ status: "ok", description, summary_markdown: summaryMarkdown }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: corsHeaders });
  }
});
