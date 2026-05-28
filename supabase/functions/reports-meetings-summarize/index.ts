import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: corsHeaders });

function localSummary(transcript: string, title: string) {
  const clean = (transcript ?? "").trim();
  if (!clean) {
    return {
      description: "Reunião sem fala transcrita. Use o botão de regenerar após adicionar transcrição manual.",
      summary_markdown: `## Resumo\n\nNenhuma fala foi capturada nesta reunião.\n\n## Próximos passos\n\n- Adicionar transcrição manual ou regravar.`,
    };
  }
  const short = clean.length > 220 ? clean.slice(0, 217) + "..." : clean;
  const lines = clean.split(/\n+/).filter(Boolean).slice(0, 8);
  return {
    description: `${title}: ${short}`,
    summary_markdown:
      `## Resumo\n\n${short}\n\n## Pontos capturados\n\n` +
      lines.map((l) => `- ${l.length > 180 ? l.slice(0, 177) + "..." : l}`).join("\n"),
  };
}

async function aiSummary(transcript: string, title: string, apiKey: string) {
  const prompt = `Você é um assistente que resume reuniões de uma BPO Financeira em português do Brasil.
Reunião: "${title}"

Transcrição:
"""
${transcript.slice(0, 12000)}
"""

Devolva APENAS um JSON válido com exatamente as chaves:
{
  "description": "uma frase com até 220 caracteres descrevendo o que foi tratado",
  "summary_markdown": "resumo em Markdown com seções ## Resumo, ## Decisões, ## Ações, ## Números mencionados"
}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Responda estritamente em JSON válido, sem prefixos nem comentários." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`ai_gateway_${res.status}`);
  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("ai_invalid_json");
  const parsed = JSON.parse(match[0]);
  if (typeof parsed.description !== "string" || typeof parsed.summary_markdown !== "string") {
    throw new Error("ai_missing_keys");
  }
  return {
    description: parsed.description.slice(0, 240),
    summary_markdown: parsed.summary_markdown.slice(0, 8000),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === "health") {
      return ok({ ok: true, function: "reports-meetings-summarize", has_ai: Boolean(aiKey), timestamp: new Date().toISOString() });
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return ok({ error: "JWT obrigatório" }, 401);
    if (!service) return ok({ error: "SUPABASE_SERVICE_ROLE_KEY ausente" }, 500);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);
    const { data: u, error: ue } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (ue || !u.user) return ok({ error: "Usuário não autenticado" }, 401);

    const id = body?.meeting_session_id;
    if (!id) return ok({ error: "meeting_session_id obrigatório" }, 400);

    const { data: session, error: selErr } = await admin
      .from("meeting_sessions")
      .select("id, transcript_text, title, duration_seconds")
      .eq("id", id)
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (selErr) throw selErr;
    if (!session) return ok({ error: "Sessão não encontrada" }, 404);

    const transcript = (session.transcript_text ?? "").toString().trim();
    let out = localSummary(transcript, session.title ?? "Reunião");
    let usedAI = false;
    let aiError: string | null = null;

    if (aiKey && transcript.length > 24) {
      try {
        out = await aiSummary(transcript, session.title ?? "Reunião", aiKey);
        usedAI = true;
      } catch (e) {
        aiError = String((e as Error)?.message ?? e).slice(0, 200);
      }
    }

    const { error: upErr } = await admin
      .from("meeting_sessions")
      .update({
        description: out.description,
        summary_markdown: out.summary_markdown,
        summary_generated_at: new Date().toISOString(),
        summary_status: "ready",
        summary_error: aiError,
      })
      .eq("id", id)
      .eq("user_id", u.user.id);
    if (upErr) throw upErr;

    // Descarte automático do áudio (somente descrição/resumo persistem)
    try {
      await fetch(`${url}/functions/v1/reports-meetings-purge-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ meeting_session_id: id }),
      });
    } catch (e) {
      console.error("purge-audio failed", e);
    }

    return ok({ ok: true, status: "ok", used_ai: usedAI, ...out });
  } catch (e) {
    return ok({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
