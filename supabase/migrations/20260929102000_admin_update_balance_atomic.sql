-- ==============================================================================
-- Migration: 20260929102000_admin_update_balance_atomic.sql
-- Description: Creates an atomic PostgreSQL RPC function for administrative manual balance adjustments.
-- Guarantees full transactional integrity and concurrency safety:
--   1. Locks the user's account row with SELECT ... FOR UPDATE (serializes concurrent modifications)
--   2. Verifies expected_current_balance matches the actual locked balance (optimistic conflict detection)
--   3. If balance changed concurrently, raises an exception and aborts without overwriting
--   4. If balances match, calculates delta, updates balance, and logs an audit transaction ('entrada' or 'saida')
-- If any operation or constraint fails, PostgreSQL aborts and rolls back the entire transaction.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_balance_atomic(
  _admin_id uuid,
  _user_id uuid,
  _new_balance numeric,
  _expected_current_balance numeric,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_current_balance numeric(14,2);
  v_delta numeric(14,2);
  v_clean_reason text;
  v_tx_type public.transaction_type;
  v_tx_description text;
BEGIN
  -- 1. Input sanity checks
  IF _admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin ID is required';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF _new_balance IS NULL OR _new_balance < 0 OR round(_new_balance, 2) <> _new_balance THEN
    RAISE EXCEPTION 'New balance cannot be negative';
  END IF;

  IF _expected_current_balance IS NULL THEN
    RAISE EXCEPTION 'Expected current balance is required for concurrency check';
  END IF;

  v_clean_reason := NULLIF(trim(_reason), '');

  -- 2. Lock the account row for update to serialize concurrent modifications
  SELECT id, balance
  INTO v_account_id, v_current_balance
  FROM public.accounts
  WHERE user_id = _user_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Account not found for user';
  END IF;

  -- 3. Optimistic conflict detection under the lock
  IF round(v_current_balance, 2) <> round(_expected_current_balance, 2) THEN
    RAISE EXCEPTION 'The account balance changed while you were editing. Refresh and try again.';
  END IF;

  -- 4. Calculate delta and update account
  v_delta := round(_new_balance, 2) - round(v_current_balance, 2);

  UPDATE public.accounts
  SET balance = round(_new_balance, 2),
      updated_at = now()
  WHERE id = v_account_id;

  -- 5. Insert audit transaction record if delta is non-zero
  IF v_delta > 0 THEN
    v_tx_type := 'entrada';
    v_tx_description := 'Administrative balance credit';
    IF v_clean_reason IS NOT NULL THEN
      v_tx_description := v_tx_description || ' — Reason: ' || v_clean_reason;
    END IF;

    INSERT INTO public.transactions (
      user_id,
      account_id,
      type,
      amount,
      description
    ) VALUES (
      _user_id,
      v_account_id,
      v_tx_type,
      v_delta,
      v_tx_description
    );
  ELSIF v_delta < 0 THEN
    v_tx_type := 'saida';
    v_tx_description := 'Administrative balance debit';
    IF v_clean_reason IS NOT NULL THEN
      v_tx_description := v_tx_description || ' — Reason: ' || v_clean_reason;
    END IF;

    INSERT INTO public.transactions (
      user_id,
      account_id,
      type,
      amount,
      description
    ) VALUES (
      _user_id,
      v_account_id,
      v_tx_type,
      abs(v_delta),
      v_tx_description
    );
  END IF;

  -- 6. Return structured result
  RETURN jsonb_build_object(
    'ok', true,
    'previous_balance', v_current_balance,
    'new_balance', round(_new_balance, 2),
    'delta', v_delta
  );
END;
$$;

-- Security hardening: Restrict execution strictly to service_role (invoked via server-side functions)
REVOKE EXECUTE ON FUNCTION public.admin_update_balance_atomic(
  uuid, uuid, numeric, numeric, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.admin_update_balance_atomic(
  uuid, uuid, numeric, numeric, text
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.admin_update_balance_atomic(
  uuid, uuid, numeric, numeric, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.admin_update_balance_atomic(
  uuid, uuid, numeric, numeric, text
) TO service_role;
