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
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
  END LOOP;
END;
$$;