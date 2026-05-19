
-- Drop overly broad storage policies on excel-uploads
DROP POLICY IF EXISTS "Authenticated users can read excel files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload excel files" ON storage.objects;

-- Restrict google_oauth_tokens RLS to authenticated role only
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.google_oauth_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.google_oauth_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON public.google_oauth_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.google_oauth_tokens;

CREATE POLICY "Users can view their own tokens"
  ON public.google_oauth_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON public.google_oauth_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON public.google_oauth_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON public.google_oauth_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
