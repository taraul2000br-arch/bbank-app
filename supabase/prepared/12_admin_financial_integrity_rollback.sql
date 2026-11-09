-- ==============================================================================
-- Prepared Rollback Migration 12: Admin Security & Financial Integrity Rollback
-- Location: supabase/prepared/12_admin_financial_integrity_rollback.sql
-- Description: Restores functions to previous versions (Prompt 4 baseline) if needed.
-- ==============================================================================

-- 1. Restore can_admin_see (baseline version with email check)
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
  ref_email text;
BEGIN
  lvl := public.get_admin_level(_admin_uid);
  IF lvl IS NULL THEN RETURN false; END IF;
  IF lvl = 'master' THEN RETURN true; END IF;

  SELECT referred_by INTO ref_uid FROM public.profiles WHERE user_id = _target_uid;
  IF ref_uid IS NULL THEN RETURN false; END IF;

  IF ref_uid = _admin_uid THEN RETURN true; END IF;

  IF lvl = 'comum' THEN
    RETURN false;
  END IF;

  SELECT lower(email) INTO ref_email FROM auth.users WHERE id = ref_uid;
  IF ref_email = 'user@bbank.com' THEN RETURN false; END IF;

  ref_lvl := public.get_admin_level(ref_uid);
  RETURN ref_lvl = 'comum';
END;
$function$;

REVOKE ALL ON FUNCTION public.can_admin_see(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_admin_see(uuid, uuid) TO authenticated, service_role;


-- 2. Restore submit_transfer_atomic (baseline version)
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

  SELECT id, balance, currency
  INTO v_account_id, v_current_balance, v_account_currency
  FROM public.accounts
  WHERE user_id = _user_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

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

  IF v_account_currency IS NULL OR v_account_currency <> _currency_from THEN
    RAISE EXCEPTION 'Source currency does not match account currency';
  END IF;

  SELECT account_blocked, transfer_locked
  INTO v_account_blocked, v_transfer_locked
  FROM public.profiles
  WHERE user_id = _user_id;

  IF v_account_blocked IS TRUE THEN
    RAISE EXCEPTION 'Account is blocked';
  END IF;

  IF v_transfer_locked IS TRUE THEN
    RAISE EXCEPTION 'Transfers are locked for this account';
  END IF;

  IF v_current_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

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

  UPDATE public.accounts
  SET balance = balance - _amount,
      updated_at = now()
  WHERE id = v_account_id;

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


-- 3. Restore review_transfer_atomic (baseline version)
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

    UPDATE public.profiles
    SET account_blocked = true,
        account_blocked_at = now()
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
