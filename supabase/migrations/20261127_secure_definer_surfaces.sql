-- Views must evaluate RLS as the caller, not as their creator.
ALTER VIEW public.v_lead_pipeline SET (security_invoker = true);
ALTER VIEW public.v_due_follow_ups SET (security_invoker = true);
ALTER VIEW public.v_daily_new_leads SET (security_invoker = true);
ALTER VIEW public.v_reactivation_today SET (security_invoker = true);

-- These SECURITY DEFINER functions are used only by server-side service-role
-- routes or database triggers. They must not be callable through PostgREST by
-- anonymous or ordinary authenticated users.
REVOKE EXECUTE ON FUNCTION public.apply_voucher_redemption(uuid, uuid, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_report_query(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_stock_movement(text, uuid, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_itaba_stock(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_itaba_stock_for_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_itaba_stock_on_cancel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_stock(text, uuid, uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_order_workflow() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_voucher_redemption(uuid, uuid, uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_report_query(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(text, uuid, uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_itaba_stock(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_itaba_stock_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_itaba_stock_on_cancel() TO service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_stock(text, uuid, uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_order_workflow() TO service_role;
