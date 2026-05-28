import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: corsHeaders });
const startSchema = z.object({ action: z.literal("start_session"), title: z.string().min(3).max(120) });
const autosaveSchema = z.object({ action: z.literal("autosave_session"), meeting_session_id: z.string().uuid(), transcript_text: z.string().default(""), transcript_segments: z.array(z.string()).default([]), duration_seconds: z.number().int().nonnegative().default(0), audio_chunks: z.array(z.string()).optional(), last_interim_text: z.string().optional(), live_transcript_segments: z.array(z.string()).optional() });
const finishSchema = z.object({ action: z.literal("finalize_session"), meeting_session_id: z.string().uuid(), transcript_text: z.string().default(""), duration_seconds: z.number().int().nonnegative().default(0), audio_storage_path: z.string().optional(), audio_chunks: z.array(z.string()).optional() });
const sanitizeText = (v: string) => v.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!; const anon = Deno.env.get("SUPABASE_ANON_KEY")!; const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  try {
    const auth = req.headers.get("Authorization");
    const body = await req.json().catch(() => ({}));
    if (body?.action === "health") return ok({ ok: true, function: "reports-meetings-transcribe", project_id: new URL(url).host.split(".")[0], timestamp: new Date().toISOString() });
    if (!auth?.startsWith("Bearer ")) return ok({ error: "JWT obrigatório" }, 401);
    if (!service) return ok({ error: "SUPABASE_SERVICE_ROLE_KEY ausente na Edge Function" }, 500);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, service);
    const { data: u } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    if (!u.user) return ok({ error: "Usuário não autenticado" }, 401);
    if (body.action === "start_session") {
      const i = startSchema.parse(body);
      const { data, error } = await admin.from("meeting_sessions").insert({ user_id: u.user.id, title: sanitizeText(i.title), status: "recording", cloud_status: "active", summary_status: "pending", started_at: new Date().toISOString() }).select("id").single();
      if (error) throw error; return ok({ ok: true, meeting_session_id: data.id, status: "recording", cloud_status: "active" });
    }
    if (body.action === "autosave_session") {
      const i = autosaveSchema.parse(body);
      const { data, error } = await admin.from("meeting_sessions").update({ transcript_text: sanitizeText(i.transcript_text), transcript_segments: i.transcript_segments, live_transcript_segments: i.live_transcript_segments ?? i.transcript_segments, duration_seconds: i.duration_seconds, audio_chunks: i.audio_chunks ?? [], last_autosave_at: new Date().toISOString(), status: "recording", cloud_status: "active", metadata: { last_interim_text: i.last_interim_text ?? null } }).eq("id", i.meeting_session_id).eq("user_id", u.user.id).select("id");
      if (error) throw error; if (!data?.length) return ok({ error: "Sessão não encontrada para autosave" }, 404); return ok({ ok: true, status: "recording" });
    }
    const i = finishSchema.parse(body);
    const { data, error } = await admin.from("meeting_sessions").update({ status: "finished", cloud_status: "finalized", ended_at: new Date().toISOString(), transcript_text: sanitizeText(i.transcript_text), transcript_segments: sanitizeText(i.transcript_text).split(/[\n\.\!\?]/).map(sanitizeText).filter(Boolean), action_items: [], decisions: [], mentioned_numbers: [], audio_chunks: i.audio_chunks ?? [], duration_seconds: i.duration_seconds, audio_storage_path: i.audio_storage_path ?? null, summary_status: "processing", summary_error: null }).eq("id", i.meeting_session_id).eq("user_id", u.user.id).select("id");
    if (error) throw error; if (!data?.length) return ok({ error: "Sessão não encontrada para finalização" }, 404);
    try { await fetch(`${url}/functions/v1/reports-meetings-summarize`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: auth }, body: JSON.stringify({ meeting_session_id: i.meeting_session_id }) }); } catch (e) { await admin.from("meeting_sessions").update({ summary_status: "error", summary_error: `summarize_failed: ${String((e as Error).message ?? e).slice(0, 160)}` }).eq("id", i.meeting_session_id).eq("user_id", u.user.id); }
    return ok({ ok: true, status: "finished" });
  } catch (error) { return ok({ error: error instanceof Error ? error.message : "Erro inesperado na função." }, 400); }
});
