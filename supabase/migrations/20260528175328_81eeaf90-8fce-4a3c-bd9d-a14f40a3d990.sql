ALTER TABLE public.google_sheet_connections
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'financial';

CREATE INDEX IF NOT EXISTS idx_gsc_user_purpose
  ON public.google_sheet_connections(user_id, purpose);

ALTER TABLE public.meeting_sessions
  ADD COLUMN IF NOT EXISTS source_connection_id uuid,
  ADD COLUMN IF NOT EXISTS source_sheet_tabs jsonb NOT NULL DEFAULT '[]'::jsonb;