-- ==============================================================================
-- B BANK UK — SECURITY HARDENING OF ADMINISTRATIVE & FINANCIAL FUNCTIONS
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- Description:
--   1. Revokes direct execute access from anon and authenticated on financial RPCs
--   2. Enforces internal authorization checks (verifying role in user_roles)
--   3. Restricts sensitive administrative functions strictly to service_role
-- ==============================================================================

-- 1. Helper functions: Restrict execution strictly to authenticated and service_role (revoke from anon)
REVOKE ALL ON FUNCTION public.get_admin_level(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_admin_see(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_see(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_level(uuid) TO authenticated, service_role;

-- 2. submit_transfer_atomic: Strictly service_role
REVOKE ALL ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) TO service_role;

-- 3. review_transfer_atomic: Strictly service_role with internal authorization check
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
  -- 1. Input sanity checks
  IF _transfer_id IS NULL THEN
    RAISE EXCEPTION 'Transfer ID is required';
  END IF;

  IF _reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Reviewer ID is required';
  END IF;

  -- 2. Authorization check inside the function
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _reviewer_id AND role::text IN ('admin', 'adm_geral', 'adm_comum')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Reviewer does not possess administrative privileges';
  END IF;

  IF _target_status IS NULL OR _target_status NOT IN ('aprovado', 'recusado', 'bloqueado') THEN
    RAISE EXCEPTION 'Invalid target status: %', COALESCE(_target_status, 'NULL');
  END IF;

  v_target_enum := _target_status::public.withdrawal_status;
  v_clean_reason := NULLIF(trim(_rejection_reason), '');

  IF v_target_enum = 'recusado' AND v_clean_reason IS NULL THEN
    RAISE EXCEPTION 'Rejection reason is required when rejecting a transfer';
  END IF;

  -- 3. Lock the transfer request row for update
  SELECT user_id, status, amount, beneficiary_name, protocol
  INTO v_user_id, v_current_status, v_amount, v_beneficiary_name, v_protocol
  FROM public.transfer_requests
  WHERE id = _transfer_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  -- 4. State machine validation
  IF v_current_status <> 'solicitado' THEN
    RAISE EXCEPTION 'Transfer has already been reviewed (current status: %)', v_current_status;
  END IF;

  -- 5. Execute decision
  IF v_target_enum = 'aprovado' THEN
    UPDATE public.transfer_requests
    SET status = 'aprovado',
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = _transfer_id;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'approved',
      'transfer_id', _transfer_id,
      'status', 'aprovado'
    );

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
      'Transfer refund: ' || COALESCE(v_protocol, _transfer_id::text) || ' (Rejected by admin: ' || v_clean_reason || ')'
    );

    UPDATE public.transfer_requests
    SET status = 'recusado',
        rejection_reason = v_clean_reason,
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = _transfer_id;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'refunded',
      'transfer_id', _transfer_id,
      'refund_amount', v_amount,
      'new_balance', v_current_balance + v_amount,
      'status', 'recusado'
    );

  ELSIF v_target_enum = 'bloqueado' THEN
    UPDATE public.transfer_requests
    SET status = 'bloqueado',
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = _transfer_id;

    UPDATE public.profiles
    SET account_blocked = true,
        account_blocked_at = now(),
        transfer_locked = true,
        updated_at = now()
    WHERE user_id = v_user_id;

    UPDATE public.accounts
    SET is_blocked = true,
        transfer_locked = true,
        status = 'bloqueado',
        updated_at = now()
    WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'blocked',
      'transfer_id', _transfer_id,
      'status', 'bloqueado'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_transfer_atomic(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_transfer_atomic(uuid, uuid, text, text) TO service_role;

-- 4. admin_update_balance_atomic: Strictly service_role with internal authorization check
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

  -- 2. Authorization check inside the function
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _admin_id AND role::text IN ('admin', 'adm_geral')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: User does not possess balance management privileges';
  END IF;

  IF _new_balance IS NULL OR _new_balance < 0 OR round(_new_balance, 2) <> _new_balance THEN
    RAISE EXCEPTION 'New balance cannot be negative';
  END IF;

  IF _expected_current_balance IS NULL THEN
    RAISE EXCEPTION 'Expected current balance is required for concurrency check';
  END IF;

  v_clean_reason := NULLIF(trim(_reason), '');

  -- 3. Lock account row for update
  SELECT id, balance
  INTO v_account_id, v_current_balance
  FROM public.accounts
  WHERE user_id = _user_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Account not found for user';
  END IF;

  -- 4. Optimistic concurrency check
  IF v_current_balance <> _expected_current_balance THEN
    RAISE EXCEPTION 'The account balance changed while you were editing. Refresh and try again.';
  END IF;

  IF v_current_balance = _new_balance THEN
    RETURN jsonb_build_object(
      'ok', true,
      'modified', false,
      'balance', v_current_balance
    );
  END IF;

  v_delta := _new_balance - v_current_balance;

  UPDATE public.accounts
  SET balance = _new_balance,
      updated_at = now()
  WHERE id = v_account_id;

  IF v_delta > 0 THEN
    v_tx_type := 'entrada';
    v_tx_description := 'Manual adjustment: ' || COALESCE(v_clean_reason, 'Credited by administrator');
  ELSE
    v_tx_type := 'saida';
    v_tx_description := 'Manual adjustment: ' || COALESCE(v_clean_reason, 'Debited by administrator');
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

  RETURN jsonb_build_object(
    'ok', true,
    'modified', true,
    'previous_balance', v_current_balance,
    'new_balance', _new_balance,
    'delta', v_delta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_balance_atomic(uuid, uuid, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_balance_atomic(uuid, uuid, numeric, numeric, text) TO service_role;
