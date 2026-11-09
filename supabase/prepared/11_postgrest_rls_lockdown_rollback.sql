-- ==============================================================================
-- 11_POSTGREST_RLS_LOCKDOWN_ROLLBACK.SQL — ROLLBACK SCRIPT (PROMPT 4/8)
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- Status: PREPARED FOR CONTINGENCY ROLLBACK
-- DO NOT EXECUTE AUTOMATICALLY
-- ==============================================================================
-- Restores baseline table permissions and RLS policies from 00_staging_baseline_schema.sql.
-- ==============================================================================

-- 1. Re-grant Table Permissions to 'authenticated' and 'anon'
DO $$
DECLARE
  tbl text;
  tables_to_restore text[] := ARRAY[
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
    'customer_complaints'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_restore LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon', tbl);
    END IF;
  END LOOP;
END;
$$;

-- 2. Restore Sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;

-- 3. Restore Baseline RLS Policies
-- Profiles
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Admins update profiles in scope" ON public.profiles;
CREATE POLICY "Admins update profiles in scope" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

-- User Roles
DROP POLICY IF EXISTS "Users view own role" ON public.user_roles;
CREATE POLICY "Users view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.get_admin_level(auth.uid()) IS NOT NULL);

-- Accounts
DROP POLICY IF EXISTS "Users view own account" ON public.accounts;
CREATE POLICY "Users view own account" ON public.accounts
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Admins update accounts" ON public.accounts;
CREATE POLICY "Admins update accounts" ON public.accounts
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- Transactions
DROP POLICY IF EXISTS "Users view own transactions" ON public.transactions;
CREATE POLICY "Users view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Admins insert transactions" ON public.transactions;
CREATE POLICY "Admins insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (public.can_admin_see(auth.uid(), user_id));

-- Transfer Requests
DROP POLICY IF EXISTS "Users view own transfer requests" ON public.transfer_requests;
CREATE POLICY "Users view own transfer requests" ON public.transfer_requests
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users insert own transfer requests" ON public.transfer_requests;
CREATE POLICY "Users insert own transfer requests" ON public.transfer_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update transfer requests" ON public.transfer_requests;
CREATE POLICY "Admins update transfer requests" ON public.transfer_requests
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- Cards
DROP POLICY IF EXISTS "Users view own cards" ON public.cards;
CREATE POLICY "Users view own cards" ON public.cards
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users request own cards" ON public.cards;
CREATE POLICY "Users request own cards" ON public.cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Card Requests
DROP POLICY IF EXISTS "users view own card requests" ON public.card_requests;
CREATE POLICY "users view own card requests" ON public.card_requests
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "users create own card requests" ON public.card_requests;
CREATE POLICY "users create own card requests" ON public.card_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- KYC Submissions
DROP POLICY IF EXISTS "Users view own kyc" ON public.kyc_submissions;
CREATE POLICY "Users view own kyc" ON public.kyc_submissions
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users insert own kyc" ON public.kyc_submissions;
CREATE POLICY "Users insert own kyc" ON public.kyc_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Scheduled Payments
DROP POLICY IF EXISTS "Customers can view their own scheduled payments" ON public.scheduled_payments;
CREATE POLICY "Customers can view their own scheduled payments" ON public.scheduled_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert their own scheduled payments" ON public.scheduled_payments;
CREATE POLICY "Customers can insert their own scheduled payments" ON public.scheduled_payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can cancel their own scheduled payments" ON public.scheduled_payments;
CREATE POLICY "Customers can cancel their own scheduled payments" ON public.scheduled_payments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all scheduled payments" ON public.scheduled_payments;
CREATE POLICY "Admins can view all scheduled payments" ON public.scheduled_payments
  FOR SELECT TO authenticated USING (public.get_admin_level(auth.uid()) IS NOT NULL);

-- Contact Requests
DROP POLICY IF EXISTS "Public insert for contact requests" ON public.contact_requests;
CREATE POLICY "Public insert for contact requests" ON public.contact_requests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own contact requests or admin" ON public.contact_requests;
CREATE POLICY "Users can read own contact requests or admin" ON public.contact_requests
  FOR SELECT USING (auth.uid() = user_id OR public.get_admin_level(auth.uid()) IS NOT NULL);

-- Customer Complaints
DROP POLICY IF EXISTS "Public insert for complaints" ON public.customer_complaints;
CREATE POLICY "Public insert for complaints" ON public.customer_complaints
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own complaints or admin" ON public.customer_complaints;
CREATE POLICY "Users can read own complaints or admin" ON public.customer_complaints
  FOR SELECT USING (auth.uid() = user_id OR public.get_admin_level(auth.uid()) IS NOT NULL);
