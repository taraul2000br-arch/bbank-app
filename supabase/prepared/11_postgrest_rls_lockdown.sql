-- ==============================================================================
-- 11_POSTGREST_RLS_LOCKDOWN.SQL — PREPARED MIGRATION (PROMPT 4/8)
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- Status: PREPARED FOR REVIEW AND EXPLICIT USER AUTHORIZATION
-- DO NOT EXECUTE AUTOMATICALLY — AWAITING EXPLICIT USER AUTHORIZATION
-- ==============================================================================
-- Description:
-- Locks down direct Supabase PostgREST table access for 'anon' and 'authenticated'.
-- Closes the critical vulnerability where an attacker with a raw Supabase JWT
-- (obtained from login step 1 or directly via GoTrue) could bypass:
--   1. Second-screen Sort Code verification
--   2. Backend proof header validation ('x-bbank-sc-proof')
--   3. Atomic financial RPC balance checks ('submit_transfer_atomic')
--
-- Architectural Pattern:
-- Secure BFF (Backend-For-Frontend):
--   - Direct browser access to sensitive tables via PostgREST is completely REVOKED.
--   - All reads/writes of sensitive data route through TanStack Start Server Functions.
--   - Server Functions run on the backend with service_role, strictly verifying:
--       a) Valid Supabase Auth JWT
--       b) Cryptographic Sort Code proof ('x-bbank-sc-proof')
--       c) User identity and resource ownership (context.userId === resource.user_id)
--       d) Administrative role and portfolio scope (can_admin_see)
-- ==============================================================================

-- 1. Ensure Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- 2. Revoke Direct Table Access from 'PUBLIC', 'anon', and 'authenticated'
DO $$
DECLARE
  tbl text;
  tables_to_lock text[] := ARRAY[
    'accounts',
    'profiles',
    'transactions',
    'transfer_requests',
    'withdrawal_requests',
    'cards',
    'card_requests',
    'credit_requests',
    'kyc_submissions',
    'user_roles',
    'admin_plans',
    'admin_user_notes',
    'user_login_events',
    'scheduled_payments',
    'contact_requests',
    'customer_complaints',
    'auth_verification_challenges'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_lock LOOP
    -- Check if table exists before altering permissions
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      -- Revoke all direct PostgREST privileges
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', tbl);
      -- Grant access strictly to postgres and service_role
      EXECUTE format('GRANT ALL ON TABLE public.%I TO postgres, service_role', tbl);
      -- Ensure Row Level Security is active
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END;
$$;

-- 3. Eliminate Direct Client Modification Policies (Defense in Depth)
-- Even if a table permission was ever accidentally granted to authenticated,
-- RLS default-deny prevents any direct PostgREST inserts, updates, or deletes.

-- 3.1. Drop direct client INSERT / UPDATE policies on transfer_requests
DROP POLICY IF EXISTS "Users insert own transfer requests" ON public.transfer_requests;
DROP POLICY IF EXISTS "Users view own transfer requests" ON public.transfer_requests;
DROP POLICY IF EXISTS "Admins update transfer requests" ON public.transfer_requests;

-- 3.2. Drop direct client INSERT / UPDATE policies on withdrawal_requests
DROP POLICY IF EXISTS "Users create own withdrawals" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admins update withdrawals" ON public.withdrawal_requests;

-- 3.3. Drop direct client modification policies on cards and card_requests
DROP POLICY IF EXISTS "Users request own cards" ON public.cards;
DROP POLICY IF EXISTS "Users view own cards" ON public.cards;
DROP POLICY IF EXISTS "Admins manage cards" ON public.cards;
DROP POLICY IF EXISTS "Admins delete cards" ON public.cards;
DROP POLICY IF EXISTS "users create own card requests" ON public.card_requests;
DROP POLICY IF EXISTS "users view own card requests" ON public.card_requests;
DROP POLICY IF EXISTS "admins update card requests" ON public.card_requests;

-- 3.4. Drop direct client modification policies on credit_requests
DROP POLICY IF EXISTS "Users create own credit requests" ON public.credit_requests;
DROP POLICY IF EXISTS "Users view own credit requests" ON public.credit_requests;
DROP POLICY IF EXISTS "Admins update credit requests" ON public.credit_requests;

-- 3.5. Drop direct client modification policies on kyc_submissions
DROP POLICY IF EXISTS "Users insert own kyc" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Users view own kyc" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Admins update kyc" ON public.kyc_submissions;

-- 3.6. Drop direct client modification policies on user_login_events
DROP POLICY IF EXISTS "Users insert own login events" ON public.user_login_events;
DROP POLICY IF EXISTS "Users view own login events" ON public.user_login_events;

-- 3.7. Drop direct client policies on accounts and transactions
DROP POLICY IF EXISTS "Users view own account" ON public.accounts;
DROP POLICY IF EXISTS "Admins update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins insert transactions" ON public.transactions;

-- 3.8. Drop direct client policies on profiles
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins update profiles in scope" ON public.profiles;

-- 3.9. Drop direct client policies on user_roles, admin_plans, admin_user_notes
DROP POLICY IF EXISTS "Users view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Master manages all admin plans" ON public.admin_plans;
DROP POLICY IF EXISTS "Admins view own plan" ON public.admin_plans;
DROP POLICY IF EXISTS "Admins view notes" ON public.admin_user_notes;
DROP POLICY IF EXISTS "Admins insert notes" ON public.admin_user_notes;

-- 3.10. Drop direct client policies on scheduled_payments (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_payments') THEN
    DROP POLICY IF EXISTS "Customers can view their own scheduled payments" ON public.scheduled_payments;
    DROP POLICY IF EXISTS "Customers can insert their own scheduled payments" ON public.scheduled_payments;
    DROP POLICY IF EXISTS "Customers can update their own scheduled payments" ON public.scheduled_payments;
    DROP POLICY IF EXISTS "Customers can cancel their own scheduled payments" ON public.scheduled_payments;
    DROP POLICY IF EXISTS "Admins can view all scheduled payments" ON public.scheduled_payments;
  END IF;
END;
$$;

-- 3.11. Drop direct client policies on contact_requests and customer_complaints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_requests') THEN
    DROP POLICY IF EXISTS "Public insert for contact requests" ON public.contact_requests;
    DROP POLICY IF EXISTS "Users can read own contact requests or admin" ON public.contact_requests;
    DROP POLICY IF EXISTS "Admins can update contact requests" ON public.contact_requests;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_complaints') THEN
    DROP POLICY IF EXISTS "Public insert for complaints" ON public.customer_complaints;
    DROP POLICY IF EXISTS "Users can read own complaints or admin" ON public.customer_complaints;
    DROP POLICY IF EXISTS "Admins can update complaints" ON public.customer_complaints;
  END IF;
END;
$$;

-- 4. Sequences: Grant strictly to postgres and service_role
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;

-- 5. Helper & Administrative Functions: Enforce least privilege
-- Financial and sensitive RPCs strictly service_role:
DO $$
BEGIN
  -- submit_transfer_atomic
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'submit_transfer_atomic') THEN
    REVOKE ALL ON FUNCTION public.submit_transfer_atomic FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.submit_transfer_atomic TO service_role, postgres;
  END IF;

  -- review_transfer_atomic
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'review_transfer_atomic') THEN
    REVOKE ALL ON FUNCTION public.review_transfer_atomic FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.review_transfer_atomic TO service_role, postgres;
  END IF;

  -- admin_update_balance_atomic
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_update_balance_atomic') THEN
    REVOKE ALL ON FUNCTION public.admin_update_balance_atomic FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.admin_update_balance_atomic TO service_role, postgres;
  END IF;

  -- track_customer_complaint
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'track_customer_complaint') THEN
    REVOKE ALL ON FUNCTION public.track_customer_complaint(text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.track_customer_complaint(text) TO service_role, postgres;
  END IF;
END;
$$;
