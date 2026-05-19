
REVOKE EXECUTE ON FUNCTION public.seed_demand_checklist(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_demand_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_demand_document_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_demand_comment_event() FROM PUBLIC, anon, authenticated;
