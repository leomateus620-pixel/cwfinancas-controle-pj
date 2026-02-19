
-- Add progress tracking columns to uploaded_files
ALTER TABLE public.uploaded_files
  ADD COLUMN IF NOT EXISTS progress jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS warnings jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tab_summary jsonb DEFAULT '[]'::jsonb;

-- Ensure storage policies for excel-uploads bucket
DO $$
BEGIN
  -- Allow authenticated users to upload files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload excel files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can upload excel files"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'excel-uploads' AND auth.role() = 'authenticated');
  END IF;

  -- Allow authenticated users to read their own files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read excel files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can read excel files"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'excel-uploads' AND auth.role() = 'authenticated');
  END IF;

  -- Allow service role to read files (for Edge Function)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can read excel files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Service role can read excel files"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'excel-uploads');
  END IF;
END $$;
