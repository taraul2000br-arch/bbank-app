-- ==============================================================================
-- Prepared Migration 03: review_transfer_atomic
-- Location: supabase/prepared/03_review_transfer_atomic.sql
-- Description: Creates an atomic PostgreSQL RPC function for administrative transfer review.
-- Guarantees full transactional integrity and state-machine enforcement:
--   1. Locks the transfer_requests row with SELECT ... FOR UPDATE (serializes concurrent reviews)
--   2. Verifies current status is strictly 'solicitado' (prevents double refund / double review)
--   3. When 'aprovado': marks status as 'aprovado' without double-debiting
--   4. When 'recusado': locks account FOR UPDATE, refunds balance, logs exactly 1 'entrada' transaction, updates status
--   5. When 'bloqueado': marks status as 'bloqueado' and sets profile account_blocked = true without refunding
-- If any operation or constraint fails, PostgreSQL aborts and rolls back the entire transaction.
-- ==============================================================================

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

  IF _target_status IS NULL OR _target_status NOT IN ('aprovado', 'recusado', 'bloqueado') THEN
    RAISE EXCEPTION 'Invalid target status: %', COALESCE(_target_status, 'NULL');
  END IF;

  v_target_enum := _target_status::public.withdrawal_status;
  v_clean_reason := NULLIF(trim(_rejection_reason), '');

  IF v_target_enum = 'recusado' AND v_clean_reason IS NULL THEN
    RAISE EXCEPTION 'Rejection reason is required when rejecting a transfer';
  END IF;

  -- 2. Lock the transfer request row for update to serialize concurrent admin decisions
  SELECT user_id, status, amount, beneficiary_name, protocol
  INTO v_user_id, v_current_status, v_amount, v_beneficiary_name, v_protocol
  FROM public.transfer_requests
  WHERE id = _transfer_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  -- 3. State machine validation: only transfers in 'solicitado' can be reviewed
  IF v_current_status <> 'solicitado' THEN
    RAISE EXCEPTION 'Transfer has already been reviewed (current status: %)', v_current_status;
  END IF;

  -- 4. Execute atomic decision branch
  IF v_target_enum = 'aprovado' THEN
    UPDATE public.transfer_requests
    SET status = 'aprovado',
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        rejection_reason = NULL,
        updated_at = now()
    WHERE id = _transfer_id;

  ELSIF v_target_enum = 'recusado' THEN
    -- REJEIÇÃO E ESTORNO ATÔMICO:
    -- 1. Localiza e bloqueia a linha da conta do usuário para atualização
    SELECT id, balance
    INTO v_account_id, v_current_balance
    FROM public.accounts
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'Account not found for transfer refund';
    END IF;

    -- 2. Devolve exatamente o valor da transferência ao saldo
    UPDATE public.accounts
    SET balance = balance + v_amount,
        updated_at = now()
    WHERE id = v_account_id;

    -- 3. Insere exatamente UMA transação de estorno ('entrada') no extrato
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

    -- 4. Atualiza o status da solicitação para recusado
    UPDATE public.transfer_requests
    SET status = 'recusado',
        rejection_reason = v_clean_reason,
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = _transfer_id;

  ELSIF v_target_enum = 'bloqueado' THEN
    -- BLOQUEIO JUDICIAL / COMPLIANCE:
    -- Suspende a transferência e bloqueia a conta do usuário.
    -- O saldo retido NÃO é devolvido.
    UPDATE public.transfer_requests
    SET status = 'bloqueado',
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        rejection_reason = v_clean_reason,
        updated_at = now()
    WHERE id = _transfer_id;

    UPDATE public.profiles
    SET account_blocked = true,
        account_blocked_at = now(),
        updated_at = now()
    WHERE user_id = v_user_id;

  END IF;

  -- 5. Return structured result
  RETURN jsonb_build_object(
    'ok', true,
    'id', _transfer_id,
    'status', _target_status
  );
END;
$$;

-- Security hardening: Restrict execution strictly to service_role (invoked via server-side functions)
REVOKE EXECUTE ON FUNCTION public.review_transfer_atomic(
  uuid, uuid, text, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.review_transfer_atomic(
  uuid, uuid, text, text
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.review_transfer_atomic(
  uuid, uuid, text, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.review_transfer_atomic(
  uuid, uuid, text, text
) TO service_role;
