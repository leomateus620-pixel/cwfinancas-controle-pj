
-- ===== Sugestão automática de categoria =====
CREATE OR REPLACE FUNCTION public.suggest_demand_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  haystack text;
  rule_record record;
BEGIN
  IF NEW.category_final IS NOT NULL AND length(trim(NEW.category_final)) > 0 THEN
    RETURN NEW;
  END IF;

  haystack := lower(coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, '') || ' ' || coalesce(NEW.supplier_name, ''));

  SELECT category INTO rule_record
  FROM public.financial_category_rules
  WHERE is_active = true
    AND position(lower(keyword) IN haystack) > 0
  ORDER BY priority DESC, length(keyword) DESC
  LIMIT 1;

  IF rule_record.category IS NOT NULL THEN
    NEW.category_suggested := rule_record.category;
    NEW.ai_confidence := 0.7;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suggest_demand_category ON public.financial_demands;
CREATE TRIGGER trg_suggest_demand_category
BEFORE INSERT OR UPDATE OF title, description, supplier_name ON public.financial_demands
FOR EACH ROW EXECUTE FUNCTION public.suggest_demand_category();

REVOKE EXECUTE ON FUNCTION public.suggest_demand_category() FROM PUBLIC, anon, authenticated;

-- ===== Contagem de aprovações pendentes =====
CREATE OR REPLACE FUNCTION public.demands_pending_approvals_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.financial_demands
  WHERE status = 'aguardando_aprovacao';
$$;
