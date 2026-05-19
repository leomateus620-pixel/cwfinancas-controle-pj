
ALTER TABLE public.financial_demands
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS demand_code text,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS asana_task_id text,
  ADD COLUMN IF NOT EXISTS asana_task_url text,
  ADD COLUMN IF NOT EXISTS asana_sync_status text NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS asana_sync_error text,
  ADD COLUMN IF NOT EXISTS asana_last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_demands_asana_status ON public.financial_demands(asana_sync_status);
CREATE INDEX IF NOT EXISTS idx_demands_company_status ON public.financial_demands(company_id, status);
CREATE INDEX IF NOT EXISTS idx_demands_status_priority_due ON public.financial_demands(status, priority, due_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_demands_code_unique ON public.financial_demands(demand_code) WHERE demand_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_demand_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix text;
  next_seq int;
BEGIN
  IF NEW.demand_code IS NOT NULL AND length(trim(NEW.demand_code)) > 0 THEN
    RETURN NEW;
  END IF;
  prefix := 'DM-' || to_char(now(), 'YYYYMM');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(demand_code, '-', 3) AS int)), 0) + 1
    INTO next_seq
    FROM public.financial_demands
   WHERE demand_code LIKE prefix || '-%';
  NEW.demand_code := prefix || '-' || lpad(next_seq::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_demand_code ON public.financial_demands;
CREATE TRIGGER trg_generate_demand_code
BEFORE INSERT ON public.financial_demands
FOR EACH ROW EXECUTE FUNCTION public.generate_demand_code();

CREATE TABLE IF NOT EXISTS public.asana_integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT false,
  workspace_gid text,
  project_gid text,
  default_section_gid text,
  default_assignee_gid text,
  status_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asana_integration_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage asana settings" ON public.asana_integration_settings;
CREATE POLICY "admin manage asana settings"
ON public.asana_integration_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "internal read asana settings" ON public.asana_integration_settings;
CREATE POLICY "internal read asana settings"
ON public.asana_integration_settings
FOR SELECT
TO authenticated
USING (public.is_internal());

DROP TRIGGER IF EXISTS trg_asana_settings_updated_at ON public.asana_integration_settings;
CREATE TRIGGER trg_asana_settings_updated_at
BEFORE UPDATE ON public.asana_integration_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.asana_integration_settings (is_enabled)
SELECT false WHERE NOT EXISTS (SELECT 1 FROM public.asana_integration_settings);

CREATE TABLE IF NOT EXISTS public.asana_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid,
  action text NOT NULL,
  status text NOT NULL,
  request_payload jsonb DEFAULT '{}'::jsonb,
  response_payload jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asana_logs_demand ON public.asana_sync_logs(demand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asana_logs_status ON public.asana_sync_logs(status, created_at DESC);

ALTER TABLE public.asana_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal read asana logs" ON public.asana_sync_logs;
CREATE POLICY "internal read asana logs"
ON public.asana_sync_logs
FOR SELECT
TO authenticated
USING (public.is_internal());
