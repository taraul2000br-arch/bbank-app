-- ==============================================================================
-- Prepared Migration 12: Admin Security & Financial Integrity
-- Location: supabase/prepared/12_admin_financial_integrity.sql
-- Description:
--   1. Updates can_admin_see function: eliminates hardcoded email check ('user@bbank.com')
--      in favor of strict RBAC hierarchy based on user_roles and referred_by.
--   2. Updates submit_transfer_atomic: reconciles account blocking across both
--      profiles (account_blocked) and accounts (is_blocked / status = 'bloqueado').
--   3. Updates review_transfer_atomic: ensures that when an admin blocks an account
--      during review ('bloqueado'), both profiles and accounts tables are synchronized.
-- NOTE: DO NOT EXECUTE REMOTELY WITHOUT EXPLICIT USER AUTHORIZATION.
-- ==============================================================================

-- 1. Eliminate email-based exception in can_admin_see
CREATE OR REPLACE FUNCTION public.can_admin_see(_admin_uid uuid, _target_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  lvl text;
  ref_uid uuid;
  ref_lvl text;
BEGIN
  lvl := public.get_admin_level(_admin_uid);
  IF lvl IS NULL THEN RETURN false; END IF;
  IF lvl = 'master' THEN RETURN true; END IF;

  SELECT referred_by INTO ref_uid FROM public.profiles WHERE user_id = _target_uid;
  IF ref_uid IS NULL THEN RETURN false; END IF;

  -- Any admin can view their own directly referred clients
  IF ref_uid = _admin_uid THEN RETURN true; END IF;

  -- Comum can ONLY see their own clients
  IF lvl = 'comum' THEN
    RETURN false;
  END IF;

  -- Geral can see clients of adm_comum and their own clients
  ref_lvl := public.get_admin_level(ref_uid);
  RETURN ref_lvl = 'comum';
END;
$function$;

REVOKE ALL ON FUNCTION public.can_admin_see(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_admin_see(uuid, uuid) TO authenticated, service_role;


-- 2. Update submit_transfer_atomic to reconcile both profiles and accounts blocking
CREATE OR REPLACE FUNCTION public.submit_transfer_atomic(
  _user_id uuid,
  _protocol text,
  _beneficiary_name text,
  _beneficiary_doc text,
  _beneficiary_email text,
  _bank_name text,
  _swift text,
  _account_number text,
  _to_country text,
  _currency_from text,
  _currency_to text,
  _amount numeric,
  _fx_rate numeric,
  _converted_amount numeric,
  _purpose text,
  _reference text,
  _hmrc_doc_path text DEFAULT NULL,
  _idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_current_balance numeric(14,2);
  v_account_currency text;
  v_account_is_blocked boolean;
  v_account_status text;
  v_account_blocked boolean;
  v_transfer_locked boolean;
  v_transfer_id uuid;
  v_transaction_id uuid;
  v_clean_idempotency_key text;
  v_existing_id uuid;
  v_existing_protocol text;
  v_existing_status public.withdrawal_status;
  v_existing_amount numeric(14,2);
  v_existing_beneficiary_name text;
  v_existing_currency_from text;
  v_existing_currency_to text;
BEGIN
  -- 1. Input sanity checks
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  v_clean_idempotency_key := NULLIF(trim(_idempotency_key), '');

  IF _protocol IS NULL OR length(trim(_protocol)) < 8 THEN
    RAISE EXCEPTION 'Invalid transfer protocol';
  END IF;

  IF _amount IS NULL OR _amount <= 0 OR round(_amount, 2) <> _amount THEN
    RAISE EXCEPTION 'Invalid transfer amount';
  END IF;

  IF _fx_rate IS NULL OR _fx_rate <= 0 THEN
    RAISE EXCEPTION 'Invalid fx rate';
  END IF;

  IF _converted_amount IS NULL OR _converted_amount <= 0 OR round(_converted_amount, 2) <> _converted_amount THEN
    RAISE EXCEPTION 'Invalid converted amount';
  END IF;

  -- 2. Lock the account row for update to serialize concurrent transfer requests for this user
  SELECT id, balance, currency, is_blocked, status
  INTO v_account_id, v_current_balance, v_account_currency, v_account_is_blocked, v_account_status
  FROM public.accounts
  WHERE user_id = _user_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  -- 3. Banking-Grade Idempotency Check under the row lock
  IF v_clean_idempotency_key IS NOT NULL THEN
    SELECT id, protocol, status, amount, beneficiary_name, currency_from, currency_to
    INTO v_existing_id, v_existing_protocol, v_existing_status, v_existing_amount,
         v_existing_beneficiary_name, v_existing_currency_from, v_existing_currency_to
    FROM public.transfer_requests
    WHERE user_id = _user_id AND idempotency_key = v_clean_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      IF v_existing_amount <> round(_amount, 2)
         OR v_existing_currency_from <> _currency_from
         OR v_existing_currency_to <> _currency_to
         OR v_existing_beneficiary_name <> _beneficiary_name THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % has already been used with different transfer parameters', v_clean_idempotency_key;
      END IF;

      RETURN jsonb_build_object(
        'id', v_existing_id,
        'protocol', v_existing_protocol,
        'status', v_existing_status::text,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  -- 4. Currency validation: source currency must strictly match account currency
  IF v_account_currency IS NULL OR v_account_currency <> _currency_from THEN
    RAISE EXCEPTION 'Source currency does not match account currency';
  END IF;

  -- 5. Unified Account Blocking & Compliance Status Check
  SELECT account_blocked, transfer_locked
  INTO v_account_blocked, v_transfer_locked
  FROM public.profiles
  WHERE user_id = _user_id;

  IF v_account_blocked IS TRUE OR v_account_is_blocked IS TRUE OR v_account_status = 'bloqueado' THEN
    RAISE EXCEPTION 'Account is blocked';
  END IF;

  IF v_transfer_locked IS TRUE THEN
    RAISE EXCEPTION 'Transfers are locked for this account';
  END IF;

  -- 6. Re-verify balance under the row-level lock
  IF v_current_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- 7. Insert transfer request record
  INSERT INTO public.transfer_requests (
    user_id,
    protocol,
    idempotency_key,
    beneficiary_name,
    beneficiary_doc,
    beneficiary_email,
    bank_name,
    swift,
    account_number,
    to_country,
    currency_from,
    currency_to,
    amount,
    fx_rate,
    converted_amount,
    purpose,
    reference,
    hmrc_doc_path,
    status
  ) VALUES (
    _user_id,
    trim(_protocol),
    v_clean_idempotency_key,
    _beneficiary_name,
    _beneficiary_doc,
    _beneficiary_email,
    _bank_name,
    _swift,
    _account_number,
    _to_country,
    _currency_from,
    _currency_to,
    _amount,
    _fx_rate,
    _converted_amount,
    _purpose,
    _reference,
    _hmrc_doc_path,
    'solicitado'
  ) RETURNING id INTO v_transfer_id;

  -- 8. Atomically debit account balance
  UPDATE public.accounts
  SET balance = balance - _amount,
      updated_at = now()
  WHERE id = v_account_id;

  -- 9. Insert corresponding audit transaction entry
  INSERT INTO public.transactions (
    user_id,
    account_id,
    type,
    amount,
    description
  ) VALUES (
    _user_id,
    v_account_id,
    'saida',
    _amount,
    'International transfer to ' || _beneficiary_name || ' (' || trim(_protocol) || ')'
  ) RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'id', v_transfer_id,
    'protocol', trim(_protocol),
    'status', 'solicitado',
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_transfer_atomic(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_transfer_atomic(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text) TO service_role;


-- 3. Update review_transfer_atomic to synchronize accounts blocking on 'bloqueado'
CREATE OR REPLACE FUNCTION public.review_transfer_atomic(
  _transfer_id uuid,
  _reviewer_id uuid,
  _target_status text,
  _rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_status public.withdrawal_status;
  v_amount numeric(14,2);
  v_beneficiary_name text;
  v_protocol text;
  v_account_id uuid;
  v_current_balance numeric(14,2);
  v_clean_reason text;
  v_target_enum public.withdrawal_status;
BEGIN
  IF _transfer_id IS NULL THEN
    RAISE EXCEPTION 'Transfer ID is required';
  END IF;

  IF _reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Reviewer ID is required';
  END IF;

  IF _target_status IS NULL OR _target_status NOT IN ('aprovado', 'recusado', 'bloqueado') THEN
    RAISE EXCEPTION 'Invalid target status: %', COALESCE(_target_status, 'NULL');
  END IF;

  v_target_enum := _target_status::public.withdrawal_status;
  v_clean_reason := NULLIF(trim(_rejection_reason), '');

  IF v_target_enum = 'recusado' AND v_clean_reason IS NULL THEN
    RAISE EXCEPTION 'Rejection reason is required when rejecting a transfer';
  END IF;

  SELECT user_id, status, amount, beneficiary_name, protocol
  INTO v_user_id, v_current_status, v_amount, v_beneficiary_name, v_protocol
  FROM public.transfer_requests
  WHERE id = _transfer_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_current_status <> 'solicitado' THEN
    RAISE EXCEPTION 'Transfer has already been reviewed (current status: %)', v_current_status;
  END IF;

  IF v_target_enum = 'aprovado' THEN
    UPDATE public.transfer_requests
    SET status = 'aprovado',
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        rejection_reason = NULL,
        updated_at = now()
    WHERE id = _transfer_id;

  ELSIF v_target_enum = 'recusado' THEN
    SELECT id, balance
    INTO v_account_id, v_current_balance
    FROM public.accounts
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'Account not found for transfer refund';
    END IF;

    UPDATE public.accounts
    SET balance = balance + v_amount,
        updated_at = now()
    WHERE id = v_account_id;

    INSERT INTO public.transactions (
      user_id,
      account_id,
      type,
      amount,
      description
    ) VALUES (
      v_user_id,
      v_account_id,
      'entrada',
      v_amount,
      'Transfer refund: ' || COALESCE(v_beneficiary_name, '') || ' — Reason: ' || v_clean_reason || ' (ref ' || substr(_transfer_id::text, 1, 8) || ')'
    );

    UPDATE public.transfer_requests
    SET status = 'recusado',
        rejection_reason = v_clean_reason,
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = _transfer_id;

  ELSIF v_target_enum = 'bloqueado' THEN
    UPDATE public.transfer_requests
    SET status = 'bloqueado',
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        rejection_reason = v_clean_reason,
        updated_at = now()
    WHERE id = _transfer_id;

    -- Synchronize account blocking across BOTH profiles and accounts
    UPDATE public.profiles
    SET account_blocked = true,
        account_blocked_at = now()
    WHERE user_id = v_user_id;

    UPDATE public.accounts
    SET is_blocked = true,
        status = 'bloqueado',
        updated_at = now()
    WHERE user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'id', _transfer_id,
    'status', v_target_enum::text,
    'protocol', v_protocol
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_transfer_atomic(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_transfer_atomic(uuid, uuid, text, text) TO service_role;
