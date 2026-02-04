-- Add new columns to google_oauth_tokens
ALTER TABLE public.google_oauth_tokens
ADD COLUMN IF NOT EXISTS provider text DEFAULT 'google',
ADD COLUMN IF NOT EXISTS scope text,
ADD COLUMN IF NOT EXISTS token_type text;

-- Create google_integration_logs table for backend logging
CREATE TABLE IF NOT EXISTS public.google_integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id text NOT NULL,
  route text NOT NULL,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_google_integration_logs_user_id ON public.google_integration_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_google_integration_logs_created_at ON public.google_integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_integration_logs_level ON public.google_integration_logs(level);

-- Enable RLS
ALTER TABLE public.google_integration_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only view their own logs
CREATE POLICY "Users can view their own logs"
  ON public.google_integration_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- No insert/update/delete policies for users - only service role can write