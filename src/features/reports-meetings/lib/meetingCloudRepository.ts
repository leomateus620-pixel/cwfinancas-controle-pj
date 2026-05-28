import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const BUCKET = "meeting-reports";

export interface AudioChunkMeta {
  path: string;
  mime_type: string;
  size: number;
  created_at: string;
  sequence: number;
}

export interface MeetingRow {
  id: string;
  title: string;
  status: string;
  cloud_status: string | null;
  summary_status: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  description: string | null;
  summary_generated_at: string | null;
  audio_purged_at: string | null;
}

export interface MeetingDetailRow extends MeetingRow {
  summary_markdown: string | null;
  transcript_text: string | null;
  action_items: unknown;
  decisions: unknown;
  mentioned_numbers: unknown;
}

async function getAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("not_authenticated");
  return data.user;
}

export async function createCloudMeetingSession(title: string) {
  const user = await getAuthUser();
  const payload = {
    user_id: user.id,
    title,
    status: "recording" as const,
    cloud_status: "active" as const,
    summary_status: "pending" as const,
    started_at: new Date().toISOString(),
    duration_seconds: 0,
    transcript_text: "",
    transcript_segments: [],
    live_transcript_segments: [],
    audio_chunks: [],
    metadata: {},
  };
  const { data, error } = await db
    .from("meeting_sessions")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, userId: user.id };
}

export async function autosaveCloudMeetingSession(params: {
  meetingSessionId: string;
  transcriptText: string;
  transcriptSegments: string[];
  liveSegments: string[];
  audioChunks: AudioChunkMeta[];
  durationSeconds: number;
  lastInterim?: string;
}) {
  const user = await getAuthUser();
  const { error } = await db
    .from("meeting_sessions")
    .update({
      transcript_text: params.transcriptText,
      transcript_segments: params.transcriptSegments,
      live_transcript_segments: params.liveSegments,
      audio_chunks: params.audioChunks,
      duration_seconds: params.durationSeconds,
      last_autosave_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "recording",
      cloud_status: "active",
      metadata: { last_interim_text: params.lastInterim ?? null },
    })
    .eq("id", params.meetingSessionId)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function finalizeCloudMeetingSession(params: {
  meetingSessionId: string;
  transcriptText: string;
  transcriptSegments: string[];
  audioChunks: AudioChunkMeta[];
  durationSeconds: number;
  description: string;
  summaryMarkdown: string;
  actionItems?: unknown[];
  decisions?: unknown[];
  mentionedNumbers?: unknown[];
}) {
  const user = await getAuthUser();
  const now = new Date().toISOString();
  const { error } = await db
    .from("meeting_sessions")
    .update({
      status: "finished",
      cloud_status: "finalized",
      ended_at: now,
      transcript_text: params.transcriptText,
      transcript_segments: params.transcriptSegments,
      audio_chunks: params.audioChunks,
      duration_seconds: params.durationSeconds,
      description: params.description,
      summary_markdown: params.summaryMarkdown,
      summary_generated_at: now,
      summary_status: "ready",
      summary_error: null,
      action_items: params.actionItems ?? [],
      decisions: params.decisions ?? [],
      mentioned_numbers: params.mentionedNumbers ?? [],
      updated_at: now,
    })
    .eq("id", params.meetingSessionId)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function uploadMeetingAudioChunk(params: {
  meetingSessionId: string;
  userId: string;
  blob: Blob;
  sequence: number;
}): Promise<AudioChunkMeta | null> {
  const ext = params.blob.type.includes("mp4") ? "mp4" : "webm";
  const filePath = `${params.userId}/${params.meetingSessionId}/audio/chunk-${String(params.sequence).padStart(4, "0")}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, params.blob, {
    contentType: params.blob.type || "audio/webm",
    upsert: true,
  });
  if (error) {
    if (import.meta.env.DEV) console.warn("[meetingCloud] upload chunk falhou", error.message);
    return null;
  }
  return {
    path: filePath,
    mime_type: params.blob.type || "audio/webm",
    size: params.blob.size,
    created_at: new Date().toISOString(),
    sequence: params.sequence,
  };
}

export async function listCloudMeetings(limit = 30): Promise<MeetingRow[]> {
  const { data, error } = await db
    .from("meeting_sessions")
    .select(
      "id,title,status,cloud_status,summary_status,started_at,ended_at,duration_seconds,description,summary_generated_at,audio_purged_at",
    )
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MeetingRow[];
}

export async function getCloudMeetingDetail(id: string): Promise<MeetingDetailRow | null> {
  const { data, error } = await db
    .from("meeting_sessions")
    .select(
      "id,title,status,cloud_status,summary_status,started_at,ended_at,duration_seconds,description,summary_generated_at,audio_purged_at,summary_markdown,transcript_text,action_items,decisions,mentioned_numbers",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as MeetingDetailRow | null;
}

export async function deleteCloudMeeting(id: string) {
  const user = await getAuthUser();
  // Remove storage files best-effort
  try {
    const prefix = `${user.id}/${id}/audio`;
    const { data: listed } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (Array.isArray(listed) && listed.length > 0) {
      await supabase.storage.from(BUCKET).remove(listed.map((it) => `${prefix}/${it.name}`));
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[meetingCloud] cleanup storage falhou", e);
  }
  const { error } = await db
    .from("meeting_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function requestEnhancedSummary(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke("reports-meetings-summarize", {
      body: { meeting_session_id: id },
    });
    return !error;
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[meetingCloud] summarize falhou (silencioso)", e);
    return false;
  }
}
