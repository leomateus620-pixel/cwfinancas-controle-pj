
-- Table: dre_values (stores each DRE line per period with full traceability)
CREATE TABLE public.dre_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sheet_id uuid REFERENCES public.google_sheet_connections(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  line_key text NOT NULL,
  value numeric NOT NULL,
  source_tab text,
  source_cell text,
  source_label text,
  is_calculated boolean NOT NULL DEFAULT false,
  original_value numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dre_values_unique UNIQUE (user_id, sheet_id, period_key, line_key)
);

-- Table: dre_mappings (caches keyword mapping per sheet)
CREATE TABLE public.dre_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sheet_id uuid REFERENCES public.google_sheet_connections(id) ON DELETE CASCADE,
  tab_name text,
  header_signature text,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  format_detected text,
  confidence numeric NOT NULL DEFAULT 0.5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dre_mappings_unique UNIQUE (user_id, sheet_id, header_signature)
);

-- Enable RLS
ALTER TABLE public.dre_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for dre_values
CREATE POLICY "Users can view their own DRE values" ON public.dre_values FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own DRE values" ON public.dre_values FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own DRE values" ON public.dre_values FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own DRE values" ON public.dre_values FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for dre_mappings
CREATE POLICY "Users can view their own DRE mappings" ON public.dre_mappings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own DRE mappings" ON public.dre_mappings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own DRE mappings" ON public.dre_mappings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own DRE mappings" ON public.dre_mappings FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_dre_values_updated_at BEFORE UPDATE ON public.dre_values FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dre_mappings_updated_at BEFORE UPDATE ON public.dre_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
