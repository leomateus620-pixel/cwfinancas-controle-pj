
-- Add nucleo and section columns to dre_lines
ALTER TABLE public.dre_lines ADD COLUMN IF NOT EXISTS nucleo text DEFAULT NULL;
ALTER TABLE public.dre_lines ADD COLUMN IF NOT EXISTS section text DEFAULT NULL;

-- Add template_type to dre_periods
ALTER TABLE public.dre_periods ADD COLUMN IF NOT EXISTS template_type text DEFAULT 'DEFAULT';

-- Create dre_validation_issues table
CREATE TABLE IF NOT EXISTS public.dre_validation_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.dre_periods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rule_code text NOT NULL,
  expected_cents bigint,
  actual_cents bigint,
  diff_cents bigint,
  details_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.dre_validation_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own validation issues"
  ON public.dre_validation_issues FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own validation issues"
  ON public.dre_validation_issues FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own validation issues"
  ON public.dre_validation_issues FOR DELETE
  USING (auth.uid() = user_id);
