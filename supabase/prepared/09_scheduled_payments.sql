-- ==============================================================================
-- 09_SCHEDULED_PAYMENTS.SQL — HARDENED SECURITY & STRICT RLS REVISION
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- Status: PREPARED FOR MANUAL EXECUTION IN SUPABASE SQL EDITOR
-- DO NOT EXECUTE AUTOMATICALLY — AWAITING MANUAL USER EXECUTION
-- ==============================================================================

-- 1. Create scheduled_payments table with robust column-level domain constraints
CREATE TABLE IF NOT EXISTS public.scheduled_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beneficiary_name TEXT NOT NULL CHECK (char_length(trim(beneficiary_name)) > 0 AND char_length(beneficiary_name) <= 120),
  sort_code TEXT NOT NULL DEFAULT '10-80-00' CHECK (char_length(sort_code) <= 10),
  account_number TEXT NOT NULL CHECK (char_length(account_number) >= 6 AND char_length(account_number) <= 20),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0 AND amount <= 1000000.00),
  currency TEXT NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
  scheduled_date DATE NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('one-off', 'monthly', 'weekly')),
  reference TEXT CHECK (reference IS NULL OR char_length(reference) <= 50),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Performance and RLS Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_user_date ON public.scheduled_payments(user_id, scheduled_date ASC);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_status ON public.scheduled_payments(status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.scheduled_payments ENABLE ROW LEVEL SECURITY;

-- 4. Explicit Permissions: Principle of Least Privilege
-- Deny public and anon access completely
REVOKE ALL ON TABLE public.scheduled_payments FROM PUBLIC, anon;
-- Service role has full access for backend server functions
GRANT ALL ON TABLE public.scheduled_payments TO service_role;
-- Authenticated users have SELECT, INSERT, and UPDATE (cancellation only, enforced below)
-- Explicitly NO DELETE permission is granted to authenticated clients
GRANT SELECT, INSERT, UPDATE ON TABLE public.scheduled_payments TO authenticated;

-- 5. Row Level Security Policies

-- Policy 1: Customers can view only their own scheduled payments
DROP POLICY IF EXISTS "Customers can view their own scheduled payments" ON public.scheduled_payments;
CREATE POLICY "Customers can view their own scheduled payments"
  ON public.scheduled_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Customers can insert only their own scheduled payments, always starting as 'active'
DROP POLICY IF EXISTS "Customers can insert their own scheduled payments" ON public.scheduled_payments;
CREATE POLICY "Customers can insert their own scheduled payments"
  ON public.scheduled_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'active'
  );

-- Policy 3: Customers can update only their own 'active' payments, and ONLY to set status to 'cancelled'
-- Reactivation of cancelled payments is mathematically impossible under this policy
DROP POLICY IF EXISTS "Customers can cancel their own scheduled payments" ON public.scheduled_payments;
CREATE POLICY "Customers can cancel their own scheduled payments"
  ON public.scheduled_payments
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND status = 'active'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'cancelled'
  );

-- Policy 4: Administrators have strictly READ-ONLY (FOR SELECT) access across all accounts
-- Replaces previous FOR ALL with strictly FOR SELECT
DROP POLICY IF EXISTS "Admins can view all scheduled payments" ON public.scheduled_payments;
CREATE POLICY "Admins can view all scheduled payments"
  ON public.scheduled_payments
  FOR SELECT
  TO authenticated
  USING (
    (SELECT coalesce(public.is_admin(), false))
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role::text IN ('admin', 'adm_geral', 'adm_comum')
    )
  );

-- 6. Dedicated Scoped Trigger Function for Immutability & Updated_At
-- Does NOT touch or alter the shared public.update_updated_at_column() function
-- Prevents modifications of user_id, amount, beneficiary, account, date, currency, frequency, or reference
CREATE OR REPLACE FUNCTION public.protect_scheduled_payments_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Prevent modification or reactivation of cancelled payments
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled scheduled payments cannot be modified or reactivated.';
  END IF;

  -- 2. Prevent modification of completed payments
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Completed scheduled payments cannot be modified.';
  END IF;

  -- 3. Restrict status transitions: from 'active', only 'cancelled' or 'completed' is allowed
  IF OLD.status = 'active' AND NEW.status NOT IN ('active', 'cancelled', 'completed') THEN
    RAISE EXCEPTION 'Invalid status transition from % to %.', OLD.status, NEW.status;
  END IF;

  -- 4. Strict immutability: core payment parameters cannot be changed once created
  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Security violation: user_id cannot be changed.';
  END IF;

  IF NEW.amount <> OLD.amount THEN
    RAISE EXCEPTION 'Security violation: payment amount is immutable after creation.';
  END IF;

  IF NEW.beneficiary_name <> OLD.beneficiary_name THEN
    RAISE EXCEPTION 'Security violation: beneficiary name is immutable after creation.';
  END IF;

  IF NEW.sort_code <> OLD.sort_code OR NEW.account_number <> OLD.account_number THEN
    RAISE EXCEPTION 'Security violation: bank routing credentials (sort code and account number) are immutable after creation.';
  END IF;

  IF NEW.scheduled_date <> OLD.scheduled_date THEN
    RAISE EXCEPTION 'Security violation: scheduled execution date is immutable after creation.';
  END IF;

  IF NEW.frequency <> OLD.frequency THEN
    RAISE EXCEPTION 'Security violation: payment frequency is immutable after creation.';
  END IF;

  IF NEW.currency <> OLD.currency THEN
    RAISE EXCEPTION 'Security violation: currency is immutable after creation.';
  END IF;

  IF NEW.reference IS DISTINCT FROM OLD.reference THEN
    RAISE EXCEPTION 'Security violation: payment reference is immutable after creation.';
  END IF;

  -- 5. Automatically refresh updated_at timestamp
  NEW.updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public;

-- Grant execution to authenticated & service_role
REVOKE ALL ON FUNCTION public.protect_scheduled_payments_immutability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protect_scheduled_payments_immutability() TO authenticated, service_role;

-- 7. Attach Trigger to scheduled_payments table
DROP TRIGGER IF EXISTS trg_scheduled_payments_protect ON public.scheduled_payments;
CREATE TRIGGER trg_scheduled_payments_protect
  BEFORE UPDATE ON public.scheduled_payments
  FOR EACH ROW EXECUTE FUNCTION public.protect_scheduled_payments_immutability();

-- ==============================================================================
-- End of Hardened 09_scheduled_payments.sql
-- ==============================================================================
