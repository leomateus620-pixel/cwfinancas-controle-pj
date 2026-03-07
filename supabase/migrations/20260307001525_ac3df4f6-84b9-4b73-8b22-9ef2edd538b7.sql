
-- Table for Contas a Pagar / Receber
CREATE TABLE public.accounts_payable_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid REFERENCES public.google_sheet_connections(id) ON DELETE SET NULL,
  record_type text NOT NULL CHECK (record_type IN ('payable', 'receivable')),
  period_key text NOT NULL,
  source_tab text NOT NULL,
  source_row integer,
  source_layout text,
  due_date date,
  description text NOT NULL DEFAULT '',
  counterpart text,
  nf_number text,
  payment_method text,
  amount numeric(14,2) NOT NULL,
  status_raw text,
  status_normalized text NOT NULL DEFAULT 'pendente',
  notes text,
  content_hash text NOT NULL,
  sync_run_id text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connection_id, content_hash)
);

-- Performance indexes
CREATE INDEX idx_apr_user_period ON public.accounts_payable_receivable(user_id, period_key);
CREATE INDEX idx_apr_user_type ON public.accounts_payable_receivable(user_id, record_type);
CREATE INDEX idx_apr_sync_run ON public.accounts_payable_receivable(user_id, connection_id, sync_run_id);
CREATE INDEX idx_apr_last_seen ON public.accounts_payable_receivable(user_id, connection_id, last_seen_at);

-- Enable RLS
ALTER TABLE public.accounts_payable_receivable ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own apr" ON public.accounts_payable_receivable FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own apr" ON public.accounts_payable_receivable FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own apr" ON public.accounts_payable_receivable FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own apr" ON public.accounts_payable_receivable FOR DELETE USING (auth.uid() = user_id);

-- Amount precision trigger
CREATE TRIGGER trg_apr_amount_precision BEFORE INSERT OR UPDATE ON public.accounts_payable_receivable
FOR EACH ROW EXECUTE FUNCTION public.validate_amount_precision();

-- Update the validate_amount_precision function to handle the new table
CREATE OR REPLACE FUNCTION public.validate_amount_precision()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'transactions' THEN
    NEW.amount := round(NEW.amount, 2);
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    NEW.value := round(NEW.value, 2);
  ELSIF TG_TABLE_NAME = 'balance_sheet_items' THEN
    NEW.amount := round(NEW.amount, 2);
  ELSIF TG_TABLE_NAME = 'bank_balances' THEN
    NEW.opening_balance := round(NEW.opening_balance, 2);
    NEW.closing_balance := round(NEW.closing_balance, 2);
  ELSIF TG_TABLE_NAME = 'accounts_payable_receivable' THEN
    NEW.amount := round(NEW.amount, 2);
  END IF;
  RETURN NEW;
END;
$function$;

-- updated_at trigger
CREATE TRIGGER trg_apr_updated_at BEFORE UPDATE ON public.accounts_payable_receivable
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
