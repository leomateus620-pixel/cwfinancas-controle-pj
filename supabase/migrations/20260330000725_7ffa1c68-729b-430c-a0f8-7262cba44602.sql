
CREATE TABLE public.company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  setor text,
  porte text DEFAULT 'ME',
  regime_tributario text,
  num_funcionarios integer,
  faturamento_anual numeric,
  cidade text,
  estado text,
  ano_fundacao integer,
  meta_receita_mensal numeric,
  meta_despesa_mensal numeric,
  meta_lucro_mensal numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own company" ON public.company_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
