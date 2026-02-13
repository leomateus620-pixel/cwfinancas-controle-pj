
-- Create sync_tab_audit table for per-tab import auditing
CREATE TABLE public.sync_tab_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.sheet_sync_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  connection_id UUID REFERENCES public.google_sheet_connections(id) ON DELETE CASCADE,
  tab_name TEXT NOT NULL,
  period_key TEXT,
  rows_scanned INTEGER NOT NULL DEFAULT 0,
  rows_with_value INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  skip_reasons JSONB DEFAULT '{}'::jsonb,
  errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_tab_audit ENABLE ROW LEVEL SECURITY;

-- RLS: users can only see their own audit records
CREATE POLICY "Users can view their own audit records"
  ON public.sync_tab_audit FOR SELECT
  USING (auth.uid() = user_id);

-- Create unique index on transactions for batch upsert ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_row_key_unique
  ON public.transactions (user_id, source_sheet_id, external_row_key)
  WHERE external_row_key IS NOT NULL;
