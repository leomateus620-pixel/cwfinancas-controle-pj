ALTER TABLE public.meeting_sessions
  ADD COLUMN IF NOT EXISTS duration_seconds INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_chunks TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_autosave_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS live_transcript_segments TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS summary_markdown TEXT,
  ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audio_purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'pt-BR';

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_user_started
  ON public.meeting_sessions (user_id, started_at DESC);

-- Storage policies for meeting-reports bucket (owner-only by {user_id}/... prefix)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='meeting_reports_select_own') THEN
    CREATE POLICY meeting_reports_select_own ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'meeting-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='meeting_reports_insert_own') THEN
    CREATE POLICY meeting_reports_insert_own ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'meeting-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='meeting_reports_update_own') THEN
    CREATE POLICY meeting_reports_update_own ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'meeting-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='meeting_reports_delete_own') THEN
    CREATE POLICY meeting_reports_delete_own ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'meeting-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;