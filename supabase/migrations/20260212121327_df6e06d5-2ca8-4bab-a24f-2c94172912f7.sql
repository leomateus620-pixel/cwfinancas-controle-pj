
-- Create dre_periods table
CREATE TABLE public.dre_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sheet_id uuid REFERENCES public.google_sheet_connections(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  period_label text,
  col_index integer,
  validation_status text DEFAULT 'ok',
  validation_notes jsonb DEFAULT '[]'::jsonb,
  last_import_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, sheet_id, period_key)
);

ALTER TABLE public.dre_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own DRE periods" ON public.dre_periods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own DRE periods" ON public.dre_periods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own DRE periods" ON public.dre_periods FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own DRE periods" ON public.dre_periods FOR DELETE USING (auth.uid() = user_id);

-- Create dre_lines table
CREATE TABLE public.dre_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.dre_periods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  group_label text,
  line_label text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  source_cell text,
  source_tab text DEFAULT 'DRE',
  order_index integer NOT NULL,
  is_group boolean DEFAULT false,
  is_subtotal boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.dre_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own DRE lines" ON public.dre_lines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own DRE lines" ON public.dre_lines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own DRE lines" ON public.dre_lines FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own DRE lines" ON public.dre_lines FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_dre_lines_period ON public.dre_lines(period_id);
CREATE INDEX idx_dre_periods_user_sheet ON public.dre_periods(user_id, sheet_id);
