import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const startSchema = z.object({ action: z.literal("start_session"), title: z.string().min(3).max(120) });
const autosaveSchema = z.object({ action: z.literal("autosave_session"), meeting_session_id: z.string().uuid(), transcript_text: z.string().default(""), transcript_segments: z.array(z.string()).default([]), duration_seconds: z.number().int().nonnegative().default(0), audio_chunks: z.array(z.string()).optional(), last_interim_text: z.string().optional(), live_transcript_segments: z.array(z.string()).optional() });
const finishSchema = z.object({ action: z.literal("finalize_session"), meeting_session_id: z.string().uuid(), transcript_text: z.string().default(""), duration_seconds: z.number().int().nonnegative().default(0), audio_storage_path: z.string().optional(), audio_chunks: z.array(z.string()).optional() });

const sanitizeText = (input: string) => input.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
const split = (t: string) => sanitizeText(t).split(/[\n\.\!\?]/).map(sanitizeText).filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "JWT obrigatório" }), { status: 401, headers: corsHeaders });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    const user = u.user;
    if (!user) return new Response(JSON.stringify({ error: "Usuário não autenticado" }), { status: 401, headers: corsHeaders });
    const body = await req.json();

    if (body.action === "start_session") {
      const i = startSchema.parse(body);
      const { data, error } = await supabase.from("meeting_sessions").insert({ user_id: user.id, title: sanitizeText(i.title), status: "recording", started_at: new Date().toISOString() }).select("id").single();
      if (error) throw error;
      return new Response(JSON.stringify({ meeting_session_id: data.id, status: "recording" }), { headers: corsHeaders });
    }

    if (body.action === "autosave_session") {
      const i = autosaveSchema.parse(body);
      const { error } = await supabase.from("meeting_sessions").update({ transcript_text: sanitizeText(i.transcript_text), transcript_segments: i.transcript_segments, live_transcript_segments: i.live_transcript_segments ?? i.transcript_segments, duration_seconds: i.duration_seconds, audio_chunks: i.audio_chunks ?? [], last_autosave_at: new Date().toISOString(), status: "recording", metadata: { last_interim_text: i.last_interim_text ?? null } }).eq("id", i.meeting_session_id).eq("user_id", user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ status: "recording" }), { headers: corsHeaders });
    }

    const i = finishSchema.parse(body);
    const transcript = sanitizeText(i.transcript_text);
    const parts = split(transcript);
    const { error } = await supabase.from("meeting_sessions").update({ status: "finished", ended_at: new Date().toISOString(), transcript_text: transcript, transcript_segments: parts, action_items: parts.filter((p) => /responsável|prazo|fazer|entregar/i.test(p)), decisions: parts.filter((p) => /decid|aprov/i.test(p)), mentioned_numbers: parts.filter((p) => /\d|r\$/i.test(p)), audio_chunks: i.audio_chunks ?? [], duration_seconds: i.duration_seconds, audio_storage_path: i.audio_storage_path ?? null }).eq("id", i.meeting_session_id).eq("user_id", user.id);
    if (error) throw error;
    return new Response(JSON.stringify({ status: "finished", transcript_text: transcript, note: "Sem conteúdo fictício." }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado na função." }), { status: 400, headers: corsHeaders });
  }
});
