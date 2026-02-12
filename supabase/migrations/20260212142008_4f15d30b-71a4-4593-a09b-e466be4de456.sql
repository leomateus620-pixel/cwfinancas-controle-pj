
-- ================================================
-- FORECAST MODULE: forecast_monthly + forecast_insights
-- ================================================

-- Table 1: forecast_monthly (historical + predicted data)
CREATE TABLE public.forecast_monthly (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sheet_id uuid REFERENCES public.google_sheet_connections(id) ON DELETE SET NULL,
  month_key text NOT NULL,
  receita_real numeric DEFAULT 0,
  despesa_real numeric DEFAULT 0,
  saldo_real numeric DEFAULT 0,
  receita_prev_base numeric,
  despesa_prev_base numeric,
  saldo_prev_base numeric,
  receita_prev_opt numeric,
  receita_prev_pess numeric,
  despesa_prev_opt numeric,
  despesa_prev_pess numeric,
  saldo_prev_opt numeric,
  saldo_prev_pess numeric,
  confidence_score numeric DEFAULT 0,
  validation_status text DEFAULT 'ok',
  calibration_notes jsonb DEFAULT '[]'::jsonb,
  is_forecast boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forecast_monthly_unique UNIQUE (user_id, sheet_id, month_key)
);

-- RLS for forecast_monthly
ALTER TABLE public.forecast_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own forecasts"
  ON public.forecast_monthly FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own forecasts"
  ON public.forecast_monthly FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own forecasts"
  ON public.forecast_monthly FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own forecasts"
  ON public.forecast_monthly FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_forecast_monthly_updated_at
  BEFORE UPDATE ON public.forecast_monthly
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table 2: forecast_insights (AI-generated insights)
CREATE TABLE public.forecast_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sheet_id uuid REFERENCES public.google_sheet_connections(id) ON DELETE SET NULL,
  horizon text NOT NULL,
  summary text,
  insights jsonb DEFAULT '[]'::jsonb,
  risks jsonb DEFAULT '[]'::jsonb,
  opportunities jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for forecast_insights
ALTER TABLE public.forecast_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own forecast insights"
  ON public.forecast_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own forecast insights"
  ON public.forecast_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own forecast insights"
  ON public.forecast_insights FOR DELETE
  USING (auth.uid() = user_id);
