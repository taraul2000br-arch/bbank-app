-- ==============================================================================
-- 10_AUTH_VERIFICATION_CHALLENGES.SQL — HARDENED REVISION
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- Status: PREPARED FOR REVIEW AND EXPLICIT USER AUTHORIZATION
-- DO NOT EXECUTE AUTOMATICALLY — AWAITING EXPLICIT AUTHORIZATION
-- ==============================================================================
-- Description:
-- Establishes server-side persistent challenge tracking for client login step 2
-- (Sort Code verification). Eliminates token replay vulnerabilities by storing
-- attempt counters, status, and expiration strictly inside PostgreSQL with
-- row-level locking (SELECT ... FOR UPDATE) to prevent race conditions.
--
-- Security Hardening Applied:
-- 1. Explicit revocation of EXECUTE from PUBLIC, anon, and authenticated on ALL functions.
-- 2. Principle of Least Privilege: table and RPCs accessible ONLY to service_role and postgres.
-- 3. Strict search_path = public on all SECURITY DEFINER functions.
-- 4. Dual-layer rate limiting: max 5 challenges per user AND max 15 per IP in 15 minutes.
-- 5. Atomic state machine with row-level lock (FOR UPDATE) ensuring atomic attempt counting.
-- 6. Zero modification to existing tables, users, balances, or transactions.
-- ==============================================================================

-- 1. Create table for server-side verification challenges
CREATE TABLE IF NOT EXISTS public.auth_verification_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_session TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'locked', 'expired')),
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Performance and Cleanup Indexes
CREATE INDEX IF NOT EXISTS idx_auth_challenges_user_status ON public.auth_verification_challenges(user_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_ip ON public.auth_verification_challenges(ip_address, created_at DESC) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires ON public.auth_verification_challenges(expires_at);

-- 3. Row Level Security (RLS) — Absolute Isolation
ALTER TABLE public.auth_verification_challenges ENABLE ROW LEVEL SECURITY;

-- Complete isolation: deny all direct access to PUBLIC, anon, and authenticated
-- Only service_role (invoked by backend Server Functions) has access.
REVOKE ALL ON TABLE public.auth_verification_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auth_verification_challenges TO postgres, service_role;

-- 4. Helper function to normalize Sort Code in SQL
CREATE OR REPLACE FUNCTION public.normalize_sort_code(raw_code TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(COALESCE(raw_code, ''), '\D', '', 'g');
$$;

REVOKE ALL ON FUNCTION public.normalize_sort_code(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_sort_code(TEXT) TO postgres, service_role;

-- 5. Helper function to extract Sort Code from account/IBAN in SQL
CREATE OR REPLACE FUNCTION public.extract_account_sort_code(raw_acc TEXT, raw_iban TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  clean_iban TEXT := trim(COALESCE(raw_iban, ''));
  clean_acc TEXT := trim(COALESCE(raw_acc, ''));
  extracted TEXT;
BEGIN
  -- If IBAN starts with GB and has standard length (22 chars), sort code is at offset 9 (length 6)
  IF clean_iban ~ '^GB[0-9]{2}[A-Z]{4}[0-9]{14}$' THEN
    extracted := substr(clean_iban, 9, 6);
    RETURN substr(extracted, 1, 2) || '-' || substr(extracted, 3, 2) || '-' || substr(extracted, 5, 2);
  END IF;

  -- If account number starts with GB (IBAN in account number field)
  IF clean_acc ~ '^GB[0-9]{2}[A-Z]{4}[0-9]{14}$' THEN
    extracted := substr(clean_acc, 9, 6);
    RETURN substr(extracted, 1, 2) || '-' || substr(extracted, 3, 2) || '-' || substr(extracted, 5, 2);
  END IF;

  -- Default branch Sort Code for B BANK
  RETURN '10-80-00';
END;
$$;

REVOKE ALL ON FUNCTION public.extract_account_sort_code(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extract_account_sort_code(TEXT, TEXT) TO postgres, service_role;

-- 6. Atomic RPC function: Create Verification Challenge with Dual-Layer Rate Limiting
CREATE OR REPLACE FUNCTION public.create_verification_challenge(
  _user_id UUID,
  _encrypted_session TEXT,
  _ip_address TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_recent_count INTEGER;
  v_ip_recent_count INTEGER;
  v_clean_ip TEXT;
  v_clean_ua TEXT;
  v_new_id UUID;
BEGIN
  -- 1. Input sanitization
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: user_id is required';
  END IF;

  IF _encrypted_session IS NULL OR length(trim(_encrypted_session)) < 10 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: encrypted_session is required';
  END IF;

  v_clean_ip := NULLIF(substr(trim(_ip_address), 1, 45), '');
  v_clean_ua := NULLIF(substr(trim(_user_agent), 1, 255), '');

  -- 2. Concurrency Serialization: strictly serialize challenge creation per user
  -- Prevents race conditions where simultaneous requests attempt to bypass the rate limit
  PERFORM pg_advisory_xact_lock(hashtext('auth_verification_challenge'), hashtext(_user_id::text));

  -- 3. Dual-Layer Rate Limiting
  -- Layer A: Max 5 challenges per user in 15 minutes
  SELECT count(*) INTO v_user_recent_count
  FROM public.auth_verification_challenges
  WHERE user_id = _user_id
    AND created_at >= (now() - interval '15 minutes');

  IF v_user_recent_count >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Too many verification requests for this account. Please wait 15 minutes.';
  END IF;

  -- Layer B: Max 15 challenges per IP in 15 minutes (mitigates multi-account brute force from single origin)
  IF v_clean_ip IS NOT NULL THEN
    SELECT count(*) INTO v_ip_recent_count
    FROM public.auth_verification_challenges
    WHERE ip_address = v_clean_ip
      AND created_at >= (now() - interval '15 minutes');

    IF v_ip_recent_count >= 15 THEN
      RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Too many verification requests from this network. Please try again later.';
    END IF;
  END IF;

  -- 4. Invalidate any existing pending challenges for this user (only 1 active challenge at a time)
  UPDATE public.auth_verification_challenges
  SET status = 'expired',
      updated_at = now()
  WHERE user_id = _user_id AND status = 'pending';

  -- 5. Insert fresh challenge with strict 5-minute expiration
  INSERT INTO public.auth_verification_challenges (
    user_id,
    encrypted_session,
    ip_address,
    user_agent,
    expires_at,
    status,
    attempts,
    max_attempts
  ) VALUES (
    _user_id,
    _encrypted_session,
    v_clean_ip,
    v_clean_ua,
    now() + interval '5 minutes',
    'pending',
    0,
    3
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_verification_challenge(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_verification_challenge(UUID, TEXT, TEXT, TEXT) TO postgres, service_role;

-- 7. Atomic RPC function: Verify Sort Code Attempt under Exclusive Row Lock
CREATE OR REPLACE FUNCTION public.verify_sort_code_attempt(
  _challenge_id UUID,
  _provided_sort_code TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.auth_verification_challenges%ROWTYPE;
  v_acc_no TEXT;
  v_iban TEXT;
  v_expected_sort_code TEXT;
  v_norm_provided TEXT;
  v_norm_expected TEXT;
  v_remaining INTEGER;
BEGIN
  -- 1. Input sanity check
  IF _challenge_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing verification challenge identifier.');
  END IF;

  -- 2. Lock the challenge row exclusively to serialize concurrent attempts and eliminate race conditions
  SELECT * INTO v_row
  FROM public.auth_verification_challenges
  WHERE id = _challenge_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Your verification session was not found or has expired. Please sign in again.',
      'expired', true
    );
  END IF;

  -- 3. Strict State Machine Validation
  -- Case A: Challenge was already completed -> Permanent invalidation (single-use token)
  IF v_row.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This verification challenge has already been completed. Please sign in again.',
      'reused', true
    );
  END IF;

  -- Case B: Challenge was locked due to 3 failed attempts
  IF v_row.status = 'locked' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Maximum verification attempts exceeded. For your security, please sign in again.',
      'lockout', true
    );
  END IF;

  -- Case C: Challenge expired (> 5 minutes)
  IF v_row.status = 'expired' OR now() > v_row.expires_at THEN
    IF v_row.status <> 'expired' THEN
      UPDATE public.auth_verification_challenges
      SET status = 'expired', updated_at = now()
      WHERE id = _challenge_id;
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Your verification session has timed out. Please sign in again.',
      'expired', true
    );
  END IF;

  -- Case D: Attempts already reached maximum
  IF v_row.attempts >= v_row.max_attempts THEN
    UPDATE public.auth_verification_challenges
    SET status = 'locked', updated_at = now()
    WHERE id = _challenge_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Maximum verification attempts exceeded. For your security, please sign in again.',
      'lockout', true
    );
  END IF;

  -- 4. Authoritative Sort Code comparison
  SELECT account_number, iban INTO v_acc_no, v_iban
  FROM public.accounts
  WHERE user_id = v_row.user_id
  LIMIT 1;

  v_expected_sort_code := public.extract_account_sort_code(v_acc_no, v_iban);
  v_norm_provided := public.normalize_sort_code(_provided_sort_code);
  v_norm_expected := public.normalize_sort_code(v_expected_sort_code);

  -- 5. Compare Sort Codes
  IF v_norm_provided <> v_norm_expected OR length(v_norm_provided) <> 6 THEN
    -- Increment attempts under the row lock
    v_row.attempts := v_row.attempts + 1;
    v_remaining := GREATEST(0, v_row.max_attempts - v_row.attempts);

    IF v_remaining = 0 THEN
      -- Final attempt failed: transition status to locked
      UPDATE public.auth_verification_challenges
      SET attempts = v_row.attempts,
          status = 'locked',
          updated_at = now()
      WHERE id = _challenge_id;

      RETURN jsonb_build_object(
        'success', false,
        'lockout', true,
        'remaining_attempts', 0,
        'error', 'Maximum verification attempts exceeded. For your security, please sign in again.'
      );
    ELSE
      -- Attempts remaining: persist counter increment
      UPDATE public.auth_verification_challenges
      SET attempts = v_row.attempts,
          updated_at = now()
      WHERE id = _challenge_id;

      RETURN jsonb_build_object(
        'success', false,
        'lockout', false,
        'remaining_attempts', v_remaining,
        'error', format('The Sort Code entered does not match our records. Please check and try again (%s %s remaining).',
                        v_remaining,
                        CASE WHEN v_remaining = 1 THEN 'attempt' ELSE 'attempts' END)
      );
    END IF;
  END IF;

  -- 6. Match confirmed: mark status as completed (invalidating for any future use)
  UPDATE public.auth_verification_challenges
  SET status = 'completed',
      updated_at = now()
  WHERE id = _challenge_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_row.user_id,
    'encrypted_session', v_row.encrypted_session
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_sort_code_attempt(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_sort_code_attempt(UUID, TEXT) TO postgres, service_role;

-- 8. Routine maintenance: purge challenges older than 24 hours
CREATE OR REPLACE FUNCTION public.purge_expired_auth_challenges()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.auth_verification_challenges
  WHERE created_at < (now() - interval '24 hours');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_auth_challenges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_auth_challenges() TO postgres, service_role;
