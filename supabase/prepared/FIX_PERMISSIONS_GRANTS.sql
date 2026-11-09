-- ==============================================================================
-- B BANK UK DIGITAL BANKING — POSTGREST PERMISSIONS & GRANTS
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- Description: Grants table and function privileges to service_role, authenticated and anon.
-- Fixes PostgreSQL Error 42501 (permission denied for table / function)
-- ==============================================================================

-- 1. Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- 2. Grant table permissions to service_role and authenticated across all 13 tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'accounts',
    'admin_plans',
    'admin_user_notes',
    'card_requests',
    'cards',
    'credit_requests',
    'kyc_submissions',
    'profiles',
    'transactions',
    'transfer_requests',
    'user_login_events',
    'user_roles',
    'withdrawal_requests'
  ] LOOP
    EXECUTE format('GRANT ALL ON TABLE public.%I TO postgres, service_role', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon', tbl);
  END LOOP;
END;
$$;

-- 3. Sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;

-- 4. Helper and Administrative RPC functions (Hardened Security)
REVOKE ALL ON FUNCTION public.get_admin_level(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_admin_see(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_see(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_level(uuid) TO authenticated, service_role;

-- Financial and Admin functions restricted strictly to service_role (never callable by anon or authenticated)
REVOKE ALL ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) TO service_role;

REVOKE ALL ON FUNCTION public.review_transfer_atomic(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_transfer_atomic(uuid, uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_update_balance_atomic(uuid, uuid, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_balance_atomic(uuid, uuid, numeric, numeric, text) TO service_role;
