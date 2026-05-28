alter table public.meeting_sessions
  add column if not exists audio_chunks jsonb not null default '[]'::jsonb,
  add column if not exists live_transcript_segments jsonb not null default '[]'::jsonb,
  add column if not exists last_autosave_at timestamptz,
  add column if not exists duration_seconds integer default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists description text,
  add column if not exists summary_markdown text,
  add column if not exists summary_generated_at timestamptz,
  add column if not exists audio_purged_at timestamptz,
  add column if not exists summary_status text not null default 'pending',
  add column if not exists summary_error text,
  add column if not exists cloud_status text not null default 'pending';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='meeting_sessions' AND column_name='audio_chunks' AND data_type='ARRAY'
  ) THEN
    ALTER TABLE public.meeting_sessions
      ALTER COLUMN audio_chunks TYPE jsonb USING to_jsonb(audio_chunks),
      ALTER COLUMN audio_chunks SET DEFAULT '[]'::jsonb;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='meeting_sessions_summary_status_check') THEN
    ALTER TABLE public.meeting_sessions ADD CONSTRAINT meeting_sessions_summary_status_check CHECK (summary_status IN ('pending','processing','ready','error','ready_with_local_summary'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='meeting_sessions_cloud_status_check') THEN
    ALTER TABLE public.meeting_sessions ADD CONSTRAINT meeting_sessions_cloud_status_check CHECK (cloud_status IN ('pending','active','finalized','local','error'));
  END IF;
END$$;

insert into storage.buckets (id, name, public)
values ('meeting-reports', 'meeting-reports', false)
on conflict (id) do nothing;

drop policy if exists "meeting_reports_select_own" on storage.objects;
create policy "meeting_reports_select_own" on storage.objects for select to authenticated using (bucket_id = 'meeting-reports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "meeting_reports_insert_own" on storage.objects;
create policy "meeting_reports_insert_own" on storage.objects for insert to authenticated with check (bucket_id = 'meeting-reports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "meeting_reports_update_own" on storage.objects;
create policy "meeting_reports_update_own" on storage.objects for update to authenticated using (bucket_id = 'meeting-reports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "meeting_reports_delete_own" on storage.objects;
create policy "meeting_reports_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'meeting-reports' and (storage.foldername(name))[1] = auth.uid()::text);
