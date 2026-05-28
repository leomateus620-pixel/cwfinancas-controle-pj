-- Convert audio_chunks and live_transcript_segments to JSONB so we can store chunk metadata,
-- and ensure cloud-related columns are present and consistent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='meeting_sessions'
      AND column_name='audio_chunks' AND data_type='ARRAY'
  ) THEN
    ALTER TABLE public.meeting_sessions
      ALTER COLUMN audio_chunks DROP DEFAULT,
      ALTER COLUMN audio_chunks TYPE jsonb USING to_jsonb(audio_chunks),
      ALTER COLUMN audio_chunks SET DEFAULT '[]'::jsonb,
      ALTER COLUMN audio_chunks SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='meeting_sessions'
      AND column_name='live_transcript_segments' AND data_type='ARRAY'
  ) THEN
    ALTER TABLE public.meeting_sessions
      ALTER COLUMN live_transcript_segments DROP DEFAULT,
      ALTER COLUMN live_transcript_segments TYPE jsonb USING to_jsonb(live_transcript_segments),
      ALTER COLUMN live_transcript_segments SET DEFAULT '[]'::jsonb,
      ALTER COLUMN live_transcript_segments SET NOT NULL;
  END IF;
END$$;

-- Idempotent grants and index
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_sessions TO authenticated;
GRANT ALL ON public.meeting_sessions TO service_role;

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_user_started
  ON public.meeting_sessions (user_id, started_at DESC);

-- Ensure RLS is on and owner-only policy exists
ALTER TABLE public.meeting_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meeting_sessions_owner ON public.meeting_sessions;
CREATE POLICY meeting_sessions_owner ON public.meeting_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bucket and storage owner-only policies (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-reports','meeting-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS meeting_reports_select_own ON storage.objects;
CREATE POLICY meeting_reports_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'meeting-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS meeting_reports_insert_own ON storage.objects;
CREATE POLICY meeting_reports_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meeting-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS meeting_reports_update_own ON storage.objects;
CREATE POLICY meeting_reports_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'meeting-reports' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'meeting-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS meeting_reports_delete_own ON storage.objects;
CREATE POLICY meeting_reports_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'meeting-reports' AND (storage.foldername(name))[1] = auth.uid()::text);