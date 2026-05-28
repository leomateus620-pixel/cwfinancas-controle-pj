-- Tables
CREATE TABLE IF NOT EXISTS public.meeting_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NULL,
  source_type text NOT NULL CHECK (source_type IN ('google_sheets','google_docs','manual')),
  external_id text,
  external_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pre_meeting_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NULL,
  title text NOT NULL,
  period_start date,
  period_end date,
  source_ids uuid[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','processing','ready','error')),
  executive_summary text,
  report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_agenda jsonb NOT NULL DEFAULT '[]'::jsonb,
  pdf_storage_path text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NULL,
  pre_report_id uuid REFERENCES public.pre_meeting_reports(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','recording','processing','finished','error','waiting_transcription')),
  started_at timestamptz,
  ended_at timestamptz,
  transcript_text text,
  transcript_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  audio_storage_path text,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  mentioned_numbers jsonb NOT NULL DEFAULT '[]'::jsonb,
  adjustments jsonb NOT NULL DEFAULT '[]'::jsonb,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NULL,
  meeting_session_id uuid REFERENCES public.meeting_sessions(id) ON DELETE CASCADE,
  pre_report_id uuid REFERENCES public.pre_meeting_reports(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','ready','error')),
  alignment_score numeric,
  matched_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  divergences jsonb NOT NULL DEFAULT '[]'::jsonb,
  new_decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  financial_impacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  final_summary text,
  final_pdf_storage_path text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTs (auth-only: no anon)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_meeting_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_comparisons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_audit_logs TO authenticated;
GRANT ALL ON public.meeting_sources, public.pre_meeting_reports, public.meeting_sessions, public.meeting_comparisons, public.meeting_audit_logs TO service_role;

-- RLS
ALTER TABLE public.meeting_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_meeting_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_sources_owner" ON public.meeting_sources FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pre_meeting_reports_owner" ON public.pre_meeting_reports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meeting_sessions_owner" ON public.meeting_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meeting_comparisons_owner" ON public.meeting_comparisons FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meeting_audit_logs_owner" ON public.meeting_audit_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-reports','meeting-reports', false) ON CONFLICT (id) DO NOTHING;