import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const startSchema = z.object({ action: z.literal("start_session"), title: z.string().min(3).max(120) });
const finishSchema = z.object({ action: z.literal("finalize_session"), meeting_session_id: z.string().uuid(), transcript_text: z.string().min(1).max(100000), audio_storage_path: z.string().min(1).optional() });

const sanitizeText = (input: string) => input.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
const normalizeText = (input: string) => sanitizeText(input).toLocaleLowerCase("pt-BR");

function dedupe(values: string[]) {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = normalizeText(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTopicSummary(text: string) {
  const parts = dedupe(text.split(/[\n\.\!\?]/).map((x) => sanitizeText(x)).filter(Boolean));
  return {
    decisions: parts.filter((p) => /decidimos|ficou decidido|decisão|decisao|vamos fazer/i.test(p)),
    actions: parts.filter((p) => /responsável|responsavel|precisa fazer|\bvou\b|\bvamos\b|prazo|entregar|ajustar|revisar/i.test(p)),
    risks: parts.filter((p) => /risco|problema|atraso|inadimplência|inadimplencia|queda|negativo|preocupação|preocupacao/i.test(p)),
    numbers: parts.filter((p) => /\d|r\$|\d+%|\d{1,2}\/\d{1,2}(\/\d{2,4})?/i.test(p)),
    points: parts,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "JWT obrigatório" }), { status: 401, headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const token = auth.replace("Bearer ", "");
  const { data: userData, error: authErr } = await supabase.auth.getUser(token);
  const user = userData.user;
  if (authErr || !user) return new Response(JSON.stringify({ error: "Usuário não autenticado" }), { status: 401, headers: corsHeaders });

  try {
    const body = await req.json();
    if (body.action === "start_session") {
      const input = startSchema.parse(body);
      const { data, error } = await supabase.from("meeting_sessions").insert({ user_id: user.id, title: sanitizeText(input.title), status: "recording", started_at: new Date().toISOString() }).select("id").single();
      if (error) throw error;
      await supabase.from("meeting_audit_logs").insert({ user_id: user.id, entity_type: "meeting_session", entity_id: data.id, action: "meeting_started", metadata: { source: "web" } });
      return new Response(JSON.stringify({ meeting_session_id: data.id, status: "recording" }), { headers: corsHeaders });
    }

    const input = finishSchema.parse(body);
    const transcript = sanitizeText(input.transcript_text);
    const topicSummary = buildTopicSummary(transcript);

    const { data: session, error: fetchError } = await supabase.from("meeting_sessions").select("id,user_id").eq("id", input.meeting_session_id).single();
    if (fetchError || !session) throw new Error("Sessão de reunião não encontrada");
    if (session.user_id !== user.id) return new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: corsHeaders });

    const { error: updateErr } = await supabase.from("meeting_sessions").update({ status: "finished", ended_at: new Date().toISOString(), transcript_text: transcript, transcript_segments: topicSummary.points, action_items: topicSummary.actions, decisions: topicSummary.decisions, mentioned_numbers: topicSummary.numbers, audio_storage_path: input.audio_storage_path ?? null }).eq("id", input.meeting_session_id);
    if (updateErr) throw updateErr;

    await supabase.from("meeting_audit_logs").insert({ user_id: user.id, entity_type: "meeting_session", entity_id: input.meeting_session_id, action: "meeting_finished", metadata: { transcript_length: transcript.length, has_audio_path: Boolean(input.audio_storage_path) } });

    return new Response(JSON.stringify({ status: "finished", transcript_text: transcript, topic_summary: topicSummary, note: "Resumo gerado apenas com o transcript_text recebido. Sem geração de texto fictício." }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), { status: 400, headers: corsHeaders });
  }
});
