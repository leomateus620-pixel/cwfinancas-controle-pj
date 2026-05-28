create table if not exists meeting_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_id uuid null,
  source_type text not null check (source_type in ('google_sheets','google_docs','manual')),
  external_id text,
  external_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pre_meeting_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, company_id uuid null, title text not null,
  period_start date, period_end date, source_ids uuid[] default '{}', status text not null default 'draft' check (status in ('draft','processing','ready','error')),
  executive_summary text, report_json jsonb not null default '{}'::jsonb, insights jsonb not null default '[]'::jsonb, risks jsonb not null default '[]'::jsonb,
  suggested_agenda jsonb not null default '[]'::jsonb, pdf_storage_path text, error_message text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists meeting_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, company_id uuid null, pre_report_id uuid references pre_meeting_reports(id) on delete set null,
  title text not null, status text not null default 'scheduled' check (status in ('scheduled','recording','processing','finished','error','waiting_transcription')),
  started_at timestamptz, ended_at timestamptz, transcript_text text, transcript_segments jsonb not null default '[]'::jsonb, audio_storage_path text,
  action_items jsonb not null default '[]'::jsonb, decisions jsonb not null default '[]'::jsonb, mentioned_numbers jsonb not null default '[]'::jsonb,
  adjustments jsonb not null default '[]'::jsonb, participants jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists meeting_comparisons (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, company_id uuid null,
  meeting_session_id uuid references meeting_sessions(id) on delete cascade, pre_report_id uuid references pre_meeting_reports(id) on delete set null,
  status text not null default 'processing' check (status in ('processing','ready','error')), alignment_score numeric,
  matched_points jsonb not null default '[]'::jsonb, divergences jsonb not null default '[]'::jsonb, new_decisions jsonb not null default '[]'::jsonb,
  financial_impacts jsonb not null default '[]'::jsonb, final_summary text, final_pdf_storage_path text, error_message text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists meeting_audit_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, entity_type text not null, entity_id uuid, action text not null,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

alter table meeting_sources enable row level security;
alter table pre_meeting_reports enable row level security;
alter table meeting_sessions enable row level security;
alter table meeting_comparisons enable row level security;
alter table meeting_audit_logs enable row level security;

create policy if not exists "meeting_sources_owner" on meeting_sources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "pre_meeting_reports_owner" on pre_meeting_reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "meeting_sessions_owner" on meeting_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "meeting_comparisons_owner" on meeting_comparisons for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "meeting_audit_logs_owner" on meeting_audit_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('meeting-reports','meeting-reports', false) on conflict (id) do nothing;
