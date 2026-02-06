-- =====================================================
-- Migration: Sync Idempotente para Google Sheets
-- =====================================================

-- 1. Adicionar campos na tabela transactions para idempotência
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS external_row_key text NULL,
ADD COLUMN IF NOT EXISTS source_sheet_id uuid NULL REFERENCES public.google_sheet_connections(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_tab text NULL,
ADD COLUMN IF NOT EXISTS source_row_number integer NULL,
ADD COLUMN IF NOT EXISTS raw_data jsonb NULL;

-- 2. Criar índice único para idempotência (evita duplicações)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotent_key 
ON public.transactions (user_id, source_sheet_id, external_row_key) 
WHERE external_row_key IS NOT NULL AND source_sheet_id IS NOT NULL;

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON public.transactions (user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON public.transactions (source);

-- 4. Adicionar campos na tabela google_sheet_sync_logs para auditoria completa
ALTER TABLE public.google_sheet_sync_logs
ADD COLUMN IF NOT EXISTS mode text DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS google_revision text NULL,
ADD COLUMN IF NOT EXISTS rows_upserted integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_details jsonb NULL;

-- 5. Criar tabela para agregados diários (performance para dashboards)
CREATE TABLE IF NOT EXISTS public.financial_daily_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_sheet_id uuid REFERENCES public.google_sheet_connections(id) ON DELETE CASCADE,
  day date NOT NULL,
  total_receitas numeric(14,2) DEFAULT 0,
  total_despesas numeric(14,2) DEFAULT 0,
  net numeric(14,2) DEFAULT 0,
  transaction_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, source_sheet_id, day)
);

-- 6. Habilitar RLS na tabela de agregados
ALTER TABLE public.financial_daily_aggregates ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para agregados diários
CREATE POLICY "Users can view their own aggregates"
ON public.financial_daily_aggregates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own aggregates"
ON public.financial_daily_aggregates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own aggregates"
ON public.financial_daily_aggregates FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own aggregates"
ON public.financial_daily_aggregates FOR DELETE
USING (auth.uid() = user_id);

-- 8. Índices para agregados
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_user_day 
ON public.financial_daily_aggregates (user_id, day);

-- 9. Trigger para atualizar updated_at
CREATE TRIGGER update_financial_daily_aggregates_updated_at
BEFORE UPDATE ON public.financial_daily_aggregates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Adicionar coluna auto_sync na tabela de conexões
ALTER TABLE public.google_sheet_connections
ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_sync_interval integer DEFAULT 10;