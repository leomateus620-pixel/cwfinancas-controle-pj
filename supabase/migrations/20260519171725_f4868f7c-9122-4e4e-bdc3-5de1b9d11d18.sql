
-- Helper: identifica equipe interna
CREATE OR REPLACE FUNCTION public.is_internal()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role);
$$;

-- 1. financial_demands
CREATE TABLE public.financial_demands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  assigned_to uuid,
  demand_type text NOT NULL,
  title text NOT NULL,
  description text,
  amount numeric(14,2),
  due_date date,
  supplier_name text,
  supplier_document text,
  category_suggested text,
  category_final text,
  cost_center text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'recebida',
  ai_confidence numeric,
  requires_review boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_financial_demands_created_by ON public.financial_demands(created_by);
CREATE INDEX idx_financial_demands_assigned_to ON public.financial_demands(assigned_to);
CREATE INDEX idx_financial_demands_status ON public.financial_demands(status);
CREATE INDEX idx_financial_demands_due_date ON public.financial_demands(due_date);

CREATE TRIGGER financial_demands_updated_at
BEFORE UPDATE ON public.financial_demands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.round_demand_amount()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.amount IS NOT NULL THEN
    NEW.amount := round(NEW.amount, 2);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER financial_demands_round_amount
BEFORE INSERT OR UPDATE ON public.financial_demands
FOR EACH ROW EXECUTE FUNCTION public.round_demand_amount();

ALTER TABLE public.financial_demands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demands_select" ON public.financial_demands
FOR SELECT TO authenticated
USING (public.is_internal() OR created_by = auth.uid());

CREATE POLICY "demands_insert" ON public.financial_demands
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "demands_update" ON public.financial_demands
FOR UPDATE TO authenticated
USING (public.is_internal() OR (created_by = auth.uid() AND status = 'recebida'))
WITH CHECK (public.is_internal() OR (created_by = auth.uid() AND status = 'recebida'));

CREATE POLICY "demands_delete" ON public.financial_demands
FOR DELETE TO authenticated
USING (public.is_internal());

-- 2. financial_demand_documents
CREATE TABLE public.financial_demand_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.financial_demands(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  document_type text,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  extraction_status text DEFAULT 'pending',
  extraction_confidence numeric,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_demand_docs_demand ON public.financial_demand_documents(demand_id);
ALTER TABLE public.financial_demand_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_select" ON public.financial_demand_documents
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.financial_demands d
  WHERE d.id = demand_id AND (public.is_internal() OR d.created_by = auth.uid())));
CREATE POLICY "docs_insert" ON public.financial_demand_documents
FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.financial_demands d
  WHERE d.id = demand_id AND (public.is_internal() OR d.created_by = auth.uid())));
CREATE POLICY "docs_delete" ON public.financial_demand_documents
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.financial_demands d
  WHERE d.id = demand_id AND (public.is_internal() OR d.created_by = auth.uid())));

-- 3. financial_demand_checklist
CREATE TABLE public.financial_demand_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.financial_demands(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_by uuid,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_demand ON public.financial_demand_checklist(demand_id);
ALTER TABLE public.financial_demand_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_select" ON public.financial_demand_checklist
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.financial_demands d
  WHERE d.id = demand_id AND (public.is_internal() OR d.created_by = auth.uid())));
CREATE POLICY "checklist_modify" ON public.financial_demand_checklist
FOR ALL TO authenticated
USING (public.is_internal())
WITH CHECK (public.is_internal());

-- 4. financial_demand_comments
CREATE TABLE public.financial_demand_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.financial_demands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  comment text NOT NULL,
  visibility text NOT NULL DEFAULT 'client' CHECK (visibility IN ('internal','client')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_demand ON public.financial_demand_comments(demand_id);
ALTER TABLE public.financial_demand_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON public.financial_demand_comments
FOR SELECT TO authenticated
USING (
  public.is_internal()
  OR (visibility = 'client' AND EXISTS (SELECT 1 FROM public.financial_demands d
       WHERE d.id = demand_id AND d.created_by = auth.uid()))
);
CREATE POLICY "comments_insert" ON public.financial_demand_comments
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    public.is_internal()
    OR (visibility = 'client' AND EXISTS (SELECT 1 FROM public.financial_demands d
         WHERE d.id = demand_id AND d.created_by = auth.uid()))
  )
);
CREATE POLICY "comments_delete" ON public.financial_demand_comments
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_internal());

-- 5. financial_demand_timeline
CREATE TABLE public.financial_demand_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.financial_demands(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_timeline_demand ON public.financial_demand_timeline(demand_id);
ALTER TABLE public.financial_demand_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_select" ON public.financial_demand_timeline
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.financial_demands d
  WHERE d.id = demand_id AND (public.is_internal() OR d.created_by = auth.uid())));
CREATE POLICY "timeline_insert" ON public.financial_demand_timeline
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.financial_demands d
    WHERE d.id = demand_id AND (public.is_internal() OR d.created_by = auth.uid()))
);

-- 6. financial_category_rules
CREATE TABLE public.financial_category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  category text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER category_rules_updated_at
BEFORE UPDATE ON public.financial_category_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.financial_category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rules_select" ON public.financial_category_rules
FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules_modify" ON public.financial_category_rules
FOR ALL TO authenticated
USING (public.is_internal())
WITH CHECK (public.is_internal());

-- 7. financial_demand_tasks
CREATE TABLE public.financial_demand_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.financial_demands(id) ON DELETE CASCADE,
  assigned_to uuid,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'normal',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_demand ON public.financial_demand_tasks(demand_id);
CREATE TRIGGER demand_tasks_updated_at
BEFORE UPDATE ON public.financial_demand_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.financial_demand_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON public.financial_demand_tasks
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.financial_demands d
  WHERE d.id = demand_id AND (public.is_internal() OR d.created_by = auth.uid())));
CREATE POLICY "tasks_modify" ON public.financial_demand_tasks
FOR ALL TO authenticated
USING (public.is_internal())
WITH CHECK (public.is_internal());

-- 8. notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read_at);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.notifications
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete" ON public.notifications
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 9. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('demand-documents', 'demand-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "demand_docs_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'demand-documents' AND (
    public.is_internal()
    OR EXISTS (SELECT 1 FROM public.financial_demands d
      WHERE d.id::text = (storage.foldername(name))[1] AND d.created_by = auth.uid())
  )
);
CREATE POLICY "demand_docs_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'demand-documents' AND (
    public.is_internal()
    OR EXISTS (SELECT 1 FROM public.financial_demands d
      WHERE d.id::text = (storage.foldername(name))[1] AND d.created_by = auth.uid())
  )
);
CREATE POLICY "demand_docs_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'demand-documents' AND (
    public.is_internal()
    OR EXISTS (SELECT 1 FROM public.financial_demands d
      WHERE d.id::text = (storage.foldername(name))[1] AND d.created_by = auth.uid())
  )
);
