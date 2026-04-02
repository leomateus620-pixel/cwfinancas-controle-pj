
-- Table 1: credit_card_cycles
CREATE TABLE public.credit_card_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid REFERENCES public.google_sheet_connections(id) ON DELETE SET NULL,
  card_label text,
  period_key text NOT NULL,
  due_date date NOT NULL,
  source_sheet_id uuid REFERENCES public.google_sheet_connections(id) ON DELETE SET NULL,
  source_tab text,
  cycle_start_row integer,
  cycle_end_row integer,
  detection_confidence numeric DEFAULT 0,
  gross_amount numeric DEFAULT 0,
  reimbursement_amount numeric DEFAULT 0,
  net_amount numeric DEFAULT 0,
  transaction_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  raw_block_hash text,
  import_batch_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_card_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cc cycles" ON public.credit_card_cycles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cc_cycles_user_conn ON public.credit_card_cycles(user_id, connection_id);
CREATE INDEX idx_cc_cycles_due_date ON public.credit_card_cycles(user_id, due_date);
CREATE INDEX idx_cc_cycles_period ON public.credit_card_cycles(user_id, period_key);

CREATE TRIGGER update_cc_cycles_updated_at
  BEFORE UPDATE ON public.credit_card_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table 2: credit_card_transactions
CREATE TABLE public.credit_card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES public.credit_card_cycles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  due_date date,
  transaction_type text NOT NULL DEFAULT 'expense',
  original_description text,
  amount numeric NOT NULL DEFAULT 0,
  category_original text,
  category_normalized text,
  source_account text,
  source_row_number integer,
  row_hash text,
  detection_confidence numeric DEFAULT 0,
  detection_flags jsonb DEFAULT '{}'::jsonb,
  is_manually_overridden boolean DEFAULT false,
  override_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cc transactions" ON public.credit_card_transactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cc_txns_cycle ON public.credit_card_transactions(cycle_id);
CREATE INDEX idx_cc_txns_user ON public.credit_card_transactions(user_id, due_date);
CREATE INDEX idx_cc_txns_row_hash ON public.credit_card_transactions(row_hash);
CREATE INDEX idx_cc_txns_type ON public.credit_card_transactions(user_id, transaction_type);

CREATE TRIGGER update_cc_txns_updated_at
  BEFORE UPDATE ON public.credit_card_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table 3: credit_card_review_queue
CREATE TABLE public.credit_card_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  source_tab text,
  source_row_number integer,
  row_hash text,
  raw_snapshot jsonb DEFAULT '{}'::jsonb,
  reason_flag text,
  suggested_action text,
  confidence numeric DEFAULT 0,
  reviewed_by uuid,
  reviewed_at timestamptz,
  final_decision text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_card_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cc review" ON public.credit_card_review_queue
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cc_review_user ON public.credit_card_review_queue(user_id);
CREATE INDEX idx_cc_review_pending ON public.credit_card_review_queue(user_id) WHERE final_decision IS NULL;
