
-- Create sheet_sync_jobs table for job control with heartbeat and timeout
CREATE TABLE public.sheet_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.google_sheet_connections(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'ALL_TABS',
  status text NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  heartbeat_at timestamptz,
  progress jsonb DEFAULT '{}'::jsonb,
  error_message text,
  error_step text,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sheet_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view their own sync jobs"
ON public.sheet_sync_jobs
FOR SELECT
USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE for regular users - only service role (edge functions)

-- Index for fast lookups
CREATE INDEX idx_sync_jobs_user_connection ON public.sheet_sync_jobs(user_id, connection_id, status);
CREATE INDEX idx_sync_jobs_status ON public.sheet_sync_jobs(status, heartbeat_at);
