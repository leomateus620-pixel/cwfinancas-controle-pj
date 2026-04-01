
-- 1a. Add connection_id and metadata to company_profiles
ALTER TABLE public.company_profiles 
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES google_sheet_connections(id) ON DELETE SET NULL;

ALTER TABLE public.company_profiles 
  ADD COLUMN IF NOT EXISTS cnpj_lookup_source text,
  ADD COLUMN IF NOT EXISTS cnpj_lookup_at timestamptz,
  ADD COLUMN IF NOT EXISTS locally_edited_fields text[] DEFAULT '{}';

-- Create unique index for isolation: 1 profile per user+connection
CREATE UNIQUE INDEX IF NOT EXISTS company_profiles_user_connection 
  ON public.company_profiles(user_id, connection_id);

-- 1b. Create company_annual_goals table
CREATE TABLE IF NOT EXISTS public.company_annual_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid REFERENCES google_sheet_connections(id) ON DELETE SET NULL,
  year integer NOT NULL,
  meta_receita_anual numeric,
  meta_despesa_anual numeric,
  meta_lucro_anual numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, connection_id, year)
);

ALTER TABLE public.company_annual_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own annual goals" ON public.company_annual_goals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_annual_goals_updated_at
  BEFORE UPDATE ON public.company_annual_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
