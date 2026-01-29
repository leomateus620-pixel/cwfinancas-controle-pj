-- Table: google_sheet_connections
-- Stores Google Sheets connections for each user
CREATE TABLE public.google_sheet_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_name TEXT NOT NULL,
  sheet_name TEXT,
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  column_mapping JSONB DEFAULT '{}'::jsonb,
  data_type TEXT NOT NULL DEFAULT 'transactions',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_frequency TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, spreadsheet_id, sheet_name)
);

-- Table: google_sheet_sync_logs
-- Stores sync history for each connection
CREATE TABLE public.google_sheet_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.google_sheet_connections(id) ON DELETE CASCADE,
  rows_processed INTEGER DEFAULT 0,
  rows_imported INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running'
);

-- Enable RLS
ALTER TABLE public.google_sheet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_sheet_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for google_sheet_connections
CREATE POLICY "Users can view their own connections"
ON public.google_sheet_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections"
ON public.google_sheet_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections"
ON public.google_sheet_connections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections"
ON public.google_sheet_connections
FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for google_sheet_sync_logs (via connection ownership)
CREATE POLICY "Users can view logs of their connections"
ON public.google_sheet_sync_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.google_sheet_connections c
    WHERE c.id = connection_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert logs for their connections"
ON public.google_sheet_sync_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.google_sheet_connections c
    WHERE c.id = connection_id AND c.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_google_sheet_connections_updated_at
BEFORE UPDATE ON public.google_sheet_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_google_sheet_connections_user_id ON public.google_sheet_connections(user_id);
CREATE INDEX idx_google_sheet_sync_logs_connection_id ON public.google_sheet_sync_logs(connection_id);