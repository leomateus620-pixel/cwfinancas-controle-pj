-- ============================================
-- AI Finance Analyst Tables
-- ============================================

-- A1. ai_sheet_profiles: Cache de perfil de mapeamento de colunas
CREATE TABLE public.ai_sheet_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connected_sheet_id uuid REFERENCES google_sheet_connections(id) ON DELETE CASCADE,
  source_tab text NOT NULL,
  header_signature text NOT NULL,
  column_mapping jsonb NOT NULL DEFAULT '{}',
  parsing_rules jsonb NOT NULL DEFAULT '{}',
  skip_patterns jsonb DEFAULT '[]',
  confidence numeric(3,2) NOT NULL DEFAULT 0.5,
  ai_suggestions jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_profile_per_header 
    UNIQUE(user_id, connected_sheet_id, source_tab, header_signature)
);

CREATE INDEX idx_ai_sheet_profiles_lookup 
  ON ai_sheet_profiles(user_id, connected_sheet_id, source_tab);

ALTER TABLE ai_sheet_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profiles" 
  ON ai_sheet_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profiles" 
  ON ai_sheet_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profiles" 
  ON ai_sheet_profiles FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profiles" 
  ON ai_sheet_profiles FOR DELETE 
  USING (auth.uid() = user_id);

-- A2. ai_insights: Insights gerados pela IA
CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connected_sheet_id uuid REFERENCES google_sheet_connections(id) ON DELETE SET NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  filters jsonb DEFAULT '{}',
  kpis jsonb NOT NULL,
  insights jsonb NOT NULL,
  data_quality jsonb NOT NULL,
  model_version text NOT NULL,
  prompt_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_insights_lookup 
  ON ai_insights(user_id, date_from, date_to);

CREATE INDEX idx_ai_insights_recent 
  ON ai_insights(user_id, created_at DESC);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own insights" 
  ON ai_insights FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own insights" 
  ON ai_insights FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own insights" 
  ON ai_insights FOR DELETE 
  USING (auth.uid() = user_id);

-- A3. transaction_flags: Qualidade de dados por transação
CREATE TABLE public.transaction_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  needs_review boolean NOT NULL DEFAULT false,
  reasons text[] NOT NULL DEFAULT '{}',
  confidence numeric(3,2) DEFAULT 1.0,
  reviewed_at timestamptz,
  reviewed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_flag_per_transaction UNIQUE(transaction_id)
);

CREATE INDEX idx_transaction_flags_review 
  ON transaction_flags(transaction_id) WHERE needs_review = true;

ALTER TABLE transaction_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view flags for their transactions" 
  ON transaction_flags FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM transactions t 
      WHERE t.id = transaction_flags.transaction_id 
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert flags for their transactions" 
  ON transaction_flags FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions t 
      WHERE t.id = transaction_flags.transaction_id 
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update flags for their transactions" 
  ON transaction_flags FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM transactions t 
      WHERE t.id = transaction_flags.transaction_id 
      AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions t 
      WHERE t.id = transaction_flags.transaction_id 
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete flags for their transactions" 
  ON transaction_flags FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM transactions t 
      WHERE t.id = transaction_flags.transaction_id 
      AND t.user_id = auth.uid()
    )
  );

-- A4. Triggers para updated_at
CREATE TRIGGER update_ai_sheet_profiles_updated_at
  BEFORE UPDATE ON ai_sheet_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_flags_updated_at
  BEFORE UPDATE ON transaction_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();