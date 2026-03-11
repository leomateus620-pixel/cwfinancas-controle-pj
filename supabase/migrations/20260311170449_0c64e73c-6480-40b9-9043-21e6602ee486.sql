
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON public.transactions(user_id, type, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_movement_date ON public.transactions(user_id, movement_type, date DESC);
