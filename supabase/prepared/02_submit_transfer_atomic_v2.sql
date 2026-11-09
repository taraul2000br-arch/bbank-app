-- ==============================================================================
-- Prepared Migration 02: submit_transfer_atomic v2 (With Banking-Grade Idempotency)
-- Location: supabase/prepared/02_submit_transfer_atomic_v2.sql
-- Description: Creates an atomic PostgreSQL RPC function for submitting transfers.
-- Guarantees full transactional integrity (all-or-nothing):
--   1. Locks the user's account row with SELECT ... FOR UPDATE (serializes concurrent transfers)
--   2. Idempotency Check under lock:
--      - If idempotency_key was already processed with IDENTICAL parameters:
--        returns original transfer result immediately WITHOUT re-debiting (idempotent_replay: true).
--      - If idempotency_key was already processed with DIFFERENT parameters:
--        raises 'IDEMPOTENCY_CONFLICT' and aborts transaction.
--   3. Verifies account existence, currency match, compliance lock, and balance >= amount
--   4. Inserts into transfer_requests with persistent protocol and idempotency_key
--   5. Atomically debits the account balance
--   6. Inserts an audit transaction log in transactions ('saida')
-- If any step fails or violates constraints, PostgreSQL immediately rolls back the entire transaction.
-- ==============================================================================

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
  SELECT id, balance, currency
  INTO v_account_id, v_current_balance, v_account_currency
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
      -- Parameter Mismatch Detection: Rejects if same key is reused with different financial values
      IF v_existing_amount <> round(_amount, 2)
         OR v_existing_currency_from <> _currency_from
         OR v_existing_currency_to <> _currency_to
         OR v_existing_beneficiary_name <> _beneficiary_name THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % has already been used with different transfer parameters', v_clean_idempotency_key;
      END IF;

      -- Replay identical execution result WITHOUT re-debiting
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

  -- 5. Check profile compliance status (blocked / transfer-locked)
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
    _protocol,
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

  -- 8. Debit account balance
  UPDATE public.accounts
  SET balance = balance - _amount,
      updated_at = now()
  WHERE id = v_account_id AND balance >= _amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- 9. Insert audit transaction record for bank statement
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
    'International transfer to ' || _beneficiary_name || ' (ref ' || substr(v_transfer_id::text, 1, 8) || ')'
  ) RETURNING id INTO v_transaction_id;

  -- 10. Return structured result
  RETURN jsonb_build_object(
    'id', v_transfer_id,
    'protocol', _protocol,
    'status', 'solicitado',
    'idempotent_replay', false
  );
END;
$$;

-- Security hardening: Restrict execution strictly to service_role (invoked via server-side functions)
REVOKE ALL ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) FROM anon;

REVOKE ALL ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) TO service_role;
