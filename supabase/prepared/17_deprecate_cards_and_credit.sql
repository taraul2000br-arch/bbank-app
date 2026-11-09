-- ==============================================================================
-- Prepared Migration 17: Deprecate Cards, Credit Features & Sort Code 2FA Login
-- Location: supabase/prepared/17_deprecate_cards_and_credit.sql
-- Status: PREPARED LOCAL SCRIPT — DO NOT EXECUTE REMOTELY AUTOMATICALLY
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- ==============================================================================
--
-- PURPOSE & ARCHITECTURAL SUMMARY:
-- This SQL script documents and prepares the database-level deprecation of:
--   1. Credit Cards & Debit Cards tables, triggers, and RLS policies.
--   2. Credit request & loan applications tables.
--   3. Step 2 Sort Code verification challenge tracking tables & RPC functions.
--
-- SAFETY & PRESERVATION DIRECTIVES:
--   - DO NOT DROP or alter 'accounts.account_number', 'accounts.iban', or Sort Code logic.
--     Sort Code remains an essential bank account identifier for customer profiles,
--     wire routing, and direct debit identification.
--   - DO NOT MODIFY 'transactions' table or accounting ledger records.
--     Transactions indicating credit/debit directions (inflows/outflows) are mandatory
--     for financial audit compliance, account statements, and ledger balancing.
--   - DO NOT TOUCH 'profiles', 'user_roles', 'support_messages', or 'kyc_documents'.
--
-- ROLLBACK AVAILABILITY:
--   A complete rollback section is provided at the bottom of this file.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION 1: DISABLE TRIGGERS LINKED TO CARD REQUEST SYNCHRONIZATION
-- ------------------------------------------------------------------------------
-- Disables automatic synchronization between card_requests and cards table.
-- Existing card records remain intact for archival purposes.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_card_request_to_cards'
  ) THEN
    ALTER TABLE public.card_requests DISABLE TRIGGER trg_sync_card_request_to_cards;
    RAISE NOTICE 'Trigger trg_sync_card_request_to_cards disabled successfully.';
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- SECTION 2: REVOKE ACCESS TO DISCONTINUED 2FA SORT CODE RPC FUNCTIONS
-- ------------------------------------------------------------------------------
-- Revokes execution privileges on Sort Code challenge creation and verification.
-- Frontend now authenticates customers directly via Supabase Auth + JWT Bearer token.

REVOKE EXECUTE ON FUNCTION public.create_verification_challenge(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_sort_code_attempt(TEXT, TEXT) FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------------------------
-- SECTION 3: DEPRECATE TABLES (COMMENTS & POLICIES ISOLATION)
-- ------------------------------------------------------------------------------
-- Instead of destructive DROP TABLE, mark the tables as DEPRECATED with comments
-- and restrict write operations to prevent inadvertent data modification.

COMMENT ON TABLE public.cards IS 'DEPRECATED: Cards features removed from frontend and backend application. Preserved for audit/historical records.';
COMMENT ON TABLE public.card_requests IS 'DEPRECATED: Card issuance workflow removed. Preserved for audit/historical records.';
COMMENT ON TABLE public.credit_requests IS 'DEPRECATED: Credit facilities and loan applications removed. Preserved for audit/historical records.';
COMMENT ON TABLE public.auth_verification_challenges IS 'DEPRECATED: Login Step 2 Sort Code challenge removed. Preserved for security log audit.';

-- Restrict INSERT/UPDATE on deprecated card and credit tables to prevent stale writes
-- Note: Service role retains read access for compliance reporting.

DO $$
BEGIN
  -- Disable RLS insert policies for authenticated users on card_requests
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'card_requests' AND policyname = 'Users can insert their own card requests'
  ) THEN
    DROP POLICY "Users can insert their own card requests" ON public.card_requests;
  END IF;

  -- Disable RLS insert policies on credit_requests
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_requests' AND policyname = 'Users can insert their own credit requests'
  ) THEN
    DROP POLICY "Users can insert their own credit requests" ON public.credit_requests;
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- SECTION 4: UNUSED COLUMNS INVENTORY (DOCUMENTATION ONLY)
-- ------------------------------------------------------------------------------
-- The following table columns are no longer referenced or required by the application:
--
-- Table: public.cards
--   - label (text)
--   - card_number (text)
--   - last4 (text)
--   - expiry (text)
--   - cvv (text)
--   - credit_limit (numeric)
--   - status (text)
--
-- Table: public.card_requests
--   - card_type (text)
--   - requested_limit (numeric)
--   - holder_name (text)
--   - last4 (text)
--   - expiry (text)
--   - credit_limit (numeric)
--   - status (text)
--
-- Table: public.credit_requests
--   - amount (numeric)
--   - status (text)
--   - notes (text)
--
-- Table: public.auth_verification_challenges
--   - encrypted_session (text)
--   - attempts (integer)
--   - max_attempts (integer)
--   - status (text)
--
-- Columns that MUST REMAIN PRESERVED:
--   - public.accounts.account_number (essential bank detail)
--   - public.accounts.iban (essential bank detail)
--   - public.accounts.currency (strictly 'GBP')
--   - public.accounts.balance (core financial balance)
--   - public.transactions.* (all financial ledger entries)
--   - public.profiles.* (identity and KYC status)
--   - public.user_login_events.* (security audit log)


-- ==============================================================================
-- SECTION 5: COMPLETE ROLLBACK SCRIPT (IF EVER REQUIRED)
-- ==============================================================================
/*
-- TO RE-ENABLE DISCONTINUED STRUCTURES, EXECUTE:

-- 1. Re-enable card request sync trigger
ALTER TABLE public.card_requests ENABLE TRIGGER trg_sync_card_request_to_cards;

-- 2. Restore execution on Sort Code verification RPCs to service_role
GRANT EXECUTE ON FUNCTION public.create_verification_challenge(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_sort_code_attempt(TEXT, TEXT) TO service_role;

-- 3. Restore card_requests insert policy
CREATE POLICY "Users can insert their own card requests"
  ON public.card_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Restore credit_requests insert policy
CREATE POLICY "Users can insert their own credit requests"
  ON public.credit_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Clear deprecation table comments
COMMENT ON TABLE public.cards IS NULL;
COMMENT ON TABLE public.card_requests IS NULL;
COMMENT ON TABLE public.credit_requests IS NULL;
COMMENT ON TABLE public.auth_verification_challenges IS NULL;
*/
