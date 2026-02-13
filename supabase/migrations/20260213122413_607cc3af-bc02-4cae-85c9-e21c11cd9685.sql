
-- Add movement_type column to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS movement_type text NOT NULL DEFAULT 'INCOME';

-- Classify existing transactions based on type field
UPDATE public.transactions SET movement_type = 'EXPENSE' WHERE type = 'expense' AND movement_type != 'TRANSFER';
UPDATE public.transactions SET movement_type = 'INCOME' WHERE type = 'income' AND movement_type != 'TRANSFER';

-- Classify transfers by category (case-insensitive)
UPDATE public.transactions 
SET movement_type = 'TRANSFER' 
WHERE (
  category ILIKE '%transferência interna%'
  OR category ILIKE '%transferencia interna%'
  OR category ILIKE '%transferência%'
  OR category ILIKE '%transferencia%'
  OR category ILIKE '%aplicação%'
  OR category ILIKE '%aplicacao%'
  OR category ILIKE '%resgate%'
  OR category ILIKE '%aporte%'
  OR category ILIKE '%movimentação entre contas%'
  OR category ILIKE '%movimentacao entre contas%'
);

-- Create index for efficient filtering by movement_type
CREATE INDEX IF NOT EXISTS idx_transactions_movement_type ON public.transactions (movement_type);
