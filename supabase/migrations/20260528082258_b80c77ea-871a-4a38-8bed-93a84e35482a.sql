-- Permissões da Data API (estavam faltando — por isso o frontend caía em fallback local)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_sessions TO authenticated;
GRANT ALL ON public.meeting_sessions TO service_role;

-- Colunas referenciadas pelas Edge Functions, ainda inexistentes
ALTER TABLE public.meeting_sessions
  ADD COLUMN IF NOT EXISTS cloud_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS summary_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS summary_error TEXT;

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_user_started
  ON public.meeting_sessions (user_id, started_at DESC);