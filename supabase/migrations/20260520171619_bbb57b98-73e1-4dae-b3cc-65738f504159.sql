ALTER TABLE public.financial_demands
ADD COLUMN IF NOT EXISTS requester_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;