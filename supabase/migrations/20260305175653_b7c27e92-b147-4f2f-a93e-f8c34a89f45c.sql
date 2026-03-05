CREATE TABLE public.bank_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.google_sheet_connections(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  opening_balance NUMERIC(14,2),
  closing_balance NUMERIC(14,2),
  tab_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, connection_id, period_key, bank_name)
);

ALTER TABLE public.bank_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bank balances"
  ON public.bank_balances FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service can manage bank balances"
  ON public.bank_balances FOR ALL TO service_role
  USING (true) WITH CHECK (true);