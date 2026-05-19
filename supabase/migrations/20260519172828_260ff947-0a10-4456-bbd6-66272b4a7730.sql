
-- =========================================================
-- Etapa 2: Central de Demandas Financeiras
-- =========================================================

-- ---------- 1. Seed checklist por tipo ----------
CREATE OR REPLACE FUNCTION public.seed_demand_checklist(_demand_id uuid, _demand_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  items text[];
  i int;
BEGIN
  items := CASE lower(coalesce(_demand_type, 'outro'))
    WHEN 'pagamento' THEN ARRAY['Validar boleto/NF','Conferir dados bancários','Aprovar valor','Agendar pagamento','Confirmar pagamento']
    WHEN 'recebimento' THEN ARRAY['Conferir NF emitida','Confirmar entrada','Conciliar conta']
    WHEN 'nota_fiscal' THEN ARRAY['Validar dados','Emitir NF','Enviar ao cliente']
    WHEN 'emissao_nf' THEN ARRAY['Validar dados','Emitir NF','Enviar ao cliente']
    WHEN 'boleto' THEN ARRAY['Validar dados do boleto','Conferir vencimento','Encaminhar para pagamento']
    WHEN 'emissao_boleto' THEN ARRAY['Validar dados','Emitir boleto','Enviar ao cliente']
    WHEN 'conciliacao' THEN ARRAY['Importar extrato','Conciliar lançamentos','Validar diferenças']
    WHEN 'reembolso' THEN ARRAY['Validar comprovante','Aprovar valor','Efetuar reembolso']
    WHEN 'comprovante' THEN ARRAY['Receber comprovante','Validar dados','Arquivar']
    ELSE ARRAY['Analisar solicitação']
  END;

  FOR i IN 1 .. array_length(items, 1) LOOP
    INSERT INTO public.financial_demand_checklist (demand_id, label, sort_order)
    VALUES (_demand_id, items[i], i);
  END LOOP;
END;
$$;

-- ---------- 2. Trigger: eventos automáticos em financial_demands ----------
CREATE OR REPLACE FUNCTION public.log_demand_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  internal_user uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- timeline
    INSERT INTO public.financial_demand_timeline (demand_id, event_type, title, description, user_id, metadata)
    VALUES (NEW.id, 'created', 'Demanda criada',
      coalesce(NEW.title, ''), NEW.created_by,
      jsonb_build_object('demand_type', NEW.demand_type, 'priority', NEW.priority));

    -- checklist
    PERFORM public.seed_demand_checklist(NEW.id, NEW.demand_type);

    -- notifica equipe interna
    FOR internal_user IN
      SELECT user_id FROM public.user_roles
      WHERE role IN ('admin','manager')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (internal_user, 'demand_created', 'Nova demanda recebida',
        NEW.title, '/demands/' || NEW.id::text,
        jsonb_build_object('demand_id', NEW.id, 'demand_type', NEW.demand_type));
    END LOOP;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.financial_demand_timeline (demand_id, event_type, title, description, user_id, metadata)
      VALUES (NEW.id, 'status_changed',
        'Status alterado',
        format('De %s para %s', OLD.status, NEW.status),
        auth.uid(),
        jsonb_build_object('from', OLD.status, 'to', NEW.status));

      -- notifica cliente (quem criou)
      IF NEW.created_by IS NOT NULL AND NEW.created_by <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
        VALUES (NEW.created_by, 'demand_status', 'Status da sua demanda mudou',
          format('"%s" agora está como %s', NEW.title, NEW.status),
          '/demands/' || NEW.id::text,
          jsonb_build_object('demand_id', NEW.id, 'status', NEW.status));
      END IF;
    END IF;

    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.financial_demand_timeline (demand_id, event_type, title, description, user_id, metadata)
      VALUES (NEW.id, 'assigned', 'Demanda atribuída', NULL, auth.uid(),
        jsonb_build_object('assigned_to', NEW.assigned_to));

      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (NEW.assigned_to, 'demand_assigned', 'Você foi atribuído a uma demanda',
        NEW.title, '/demands/' || NEW.id::text,
        jsonb_build_object('demand_id', NEW.id));
    END IF;

    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at AND NEW.approved_at IS NOT NULL THEN
      INSERT INTO public.financial_demand_timeline (demand_id, event_type, title, description, user_id, metadata)
      VALUES (NEW.id, 'approved', 'Demanda aprovada', NULL, NEW.approved_by, '{}'::jsonb);
    END IF;

    IF NEW.rejected_at IS DISTINCT FROM OLD.rejected_at AND NEW.rejected_at IS NOT NULL THEN
      INSERT INTO public.financial_demand_timeline (demand_id, event_type, title, description, user_id, metadata)
      VALUES (NEW.id, 'rejected', 'Demanda rejeitada', NEW.rejection_reason, NEW.rejected_by, '{}'::jsonb);
    END IF;

    IF NEW.finalized_at IS DISTINCT FROM OLD.finalized_at AND NEW.finalized_at IS NOT NULL THEN
      INSERT INTO public.financial_demand_timeline (demand_id, event_type, title, description, user_id, metadata)
      VALUES (NEW.id, 'finalized', 'Demanda finalizada', NULL, auth.uid(), '{}'::jsonb);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_demand_event ON public.financial_demands;
CREATE TRIGGER trg_log_demand_event
AFTER INSERT OR UPDATE ON public.financial_demands
FOR EACH ROW EXECUTE FUNCTION public.log_demand_event();

-- ---------- 3. Trigger: documento enviado ----------
CREATE OR REPLACE FUNCTION public.log_demand_document_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.financial_demand_timeline (demand_id, event_type, title, description, user_id, metadata)
  VALUES (NEW.demand_id, 'document_uploaded', 'Documento enviado',
    NEW.file_name, NEW.uploaded_by,
    jsonb_build_object('document_id', NEW.id, 'file_type', NEW.file_type, 'file_size', NEW.file_size));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_demand_document ON public.financial_demand_documents;
CREATE TRIGGER trg_log_demand_document
AFTER INSERT ON public.financial_demand_documents
FOR EACH ROW EXECUTE FUNCTION public.log_demand_document_event();

-- ---------- 4. Trigger: comentário adicionado ----------
CREATE OR REPLACE FUNCTION public.log_demand_comment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.financial_demand_timeline (demand_id, event_type, title, description, user_id, metadata)
  VALUES (NEW.demand_id, 'comment_added', 'Novo comentário',
    left(NEW.comment, 200), NEW.user_id,
    jsonb_build_object('comment_id', NEW.id, 'visibility', NEW.visibility));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_demand_comment ON public.financial_demand_comments;
CREATE TRIGGER trg_log_demand_comment
AFTER INSERT ON public.financial_demand_comments
FOR EACH ROW EXECUTE FUNCTION public.log_demand_comment_event();

-- ---------- 5. Storage policies para bucket demand-documents ----------
DROP POLICY IF EXISTS "demand_docs_select" ON storage.objects;
DROP POLICY IF EXISTS "demand_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "demand_docs_delete" ON storage.objects;

CREATE POLICY "demand_docs_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'demand-documents'
  AND EXISTS (
    SELECT 1 FROM public.financial_demands d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND (public.is_internal() OR d.created_by = auth.uid())
  )
);

CREATE POLICY "demand_docs_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'demand-documents'
  AND EXISTS (
    SELECT 1 FROM public.financial_demands d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND (public.is_internal() OR d.created_by = auth.uid())
  )
);

CREATE POLICY "demand_docs_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'demand-documents'
  AND EXISTS (
    SELECT 1 FROM public.financial_demands d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND (public.is_internal() OR d.created_by = auth.uid())
  )
);
