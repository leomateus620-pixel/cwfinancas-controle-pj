alter table public.meeting_sessions
  add column if not exists audio_chunks jsonb not null default '[]'::jsonb,
  add column if not exists live_transcript_segments jsonb not null default '[]'::jsonb,
  add column if not exists last_autosave_at timestamptz,
  add column if not exists duration_seconds integer default 0;
