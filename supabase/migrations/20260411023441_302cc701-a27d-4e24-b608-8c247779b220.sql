
-- Tabela de uploads de PDFs
CREATE TABLE public.pdf_statement_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_size INTEGER,
  detected_type TEXT NOT NULL DEFAULT 'unknown',
  manual_type TEXT,
  status TEXT NOT NULL DEFAULT 'uploading',
  error_message TEXT,
  transaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pdf_statement_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pdf uploads"
  ON public.pdf_statement_uploads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pdf uploads"
  ON public.pdf_statement_uploads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pdf uploads"
  ON public.pdf_statement_uploads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pdf uploads"
  ON public.pdf_statement_uploads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_pdf_statement_uploads_updated_at
  BEFORE UPDATE ON public.pdf_statement_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de transações extraídas
CREATE TABLE public.pdf_parsed_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID NOT NULL REFERENCES public.pdf_statement_uploads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  row_index INTEGER NOT NULL DEFAULT 0,
  date TEXT,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  original_amount NUMERIC,
  is_valid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pdf_parsed_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own parsed transactions"
  ON public.pdf_parsed_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parsed transactions"
  ON public.pdf_parsed_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own parsed transactions"
  ON public.pdf_parsed_transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Storage bucket para PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-uploads', 'pdf-uploads', false);

CREATE POLICY "Users can upload own pdfs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pdf-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own pdfs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'pdf-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own pdfs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pdf-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
