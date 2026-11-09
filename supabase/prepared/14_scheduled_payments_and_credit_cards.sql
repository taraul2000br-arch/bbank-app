-- ==============================================================================
-- Prepared Migration 14: Scheduled Payments & Credit Cards Functional Hardening
-- Location: supabase/prepared/14_scheduled_payments_and_credit_cards.sql
-- Description:
--   1. Implements atomic RPC public.process_scheduled_payment_atomic(p_payment_id)
--      with row-level locking (FOR UPDATE), account block check, balance check,
--      atomic debit, transaction recording, and schedule advancement.
--   2. Enforces strict security: REVOKE EXECUTE FROM PUBLIC, anon, authenticated;
--      GRANT EXECUTE ONLY TO service_role.
--   3. Adds index for due payment queries: idx_scheduled_payments_due.
--   4. Creates database trigger to synchronize card_requests approval with cards table.
-- NOTE: DO NOT EXECUTE REMOTELY WITHOUT EXPLICIT USER AUTHORIZATION.
-- ==============================================================================

-- 1. Performance index for due scheduled payments
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_due 
  ON public.scheduled_payments (status, scheduled_date)
  WHERE status = 'active';

-- 2. Atomic scheduled payment execution function
CREATE OR REPLACE FUNCTION public.process_scheduled_payment_atomic(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_payment record;
  v_account record;
  v_profile record;
  v_next_date date;
  v_new_balance numeric;
BEGIN
  -- 1. Lock payment row to prevent concurrent duplicate execution
  SELECT * INTO v_payment
  FROM public.scheduled_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'PAYMENT_NOT_FOUND');
  END IF;

  IF v_payment.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PAYMENT_NOT_ACTIVE', 'status', v_payment.status);
  END IF;

  IF v_payment.scheduled_date > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'PAYMENT_NOT_DUE', 'scheduled_date', v_payment.scheduled_date);
  END IF;

  -- 2. Check profile block status
  SELECT account_blocked, transfer_locked INTO v_profile
  FROM public.profiles
  WHERE user_id = v_payment.user_id;

  IF FOUND AND (COALESCE(v_profile.account_blocked, false) OR COALESCE(v_profile.transfer_locked, false)) THEN
    UPDATE public.scheduled_payments
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_payment_id;
    RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_RESTRICTED');
  END IF;

  -- 3. Lock account and check balance
  SELECT id, balance, currency INTO v_account
  FROM public.accounts
  WHERE user_id = v_payment.user_id AND currency = v_payment.currency
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_NOT_FOUND');
  END IF;

  IF v_account.balance < v_payment.amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_FUNDS', 'balance', v_account.balance, 'required', v_payment.amount);
  END IF;

  -- 4. Atomic debit
  v_new_balance := v_account.balance - v_payment.amount;
  UPDATE public.accounts
  SET balance = v_new_balance, updated_at = NOW()
  WHERE id = v_account.id;

  -- 5. Record completed transaction
  INSERT INTO public.transactions (
    user_id,
    account_id,
    amount,
    type,
    description,
    created_at
  ) VALUES (
    v_payment.user_id,
    v_account.id,
    v_payment.amount,
    'saida',
    'Standing order to ' || v_payment.beneficiary_name || COALESCE(' (Ref: ' || v_payment.reference || ')', ''),
    NOW()
  );

  -- 6. Advance schedule or mark completed
  IF v_payment.frequency = 'one-off' THEN
    UPDATE public.scheduled_payments
    SET status = 'completed', updated_at = NOW()
    WHERE id = p_payment_id;
  ELSIF v_payment.frequency = 'weekly' THEN
    v_next_date := v_payment.scheduled_date + interval '7 days';
    UPDATE public.scheduled_payments
    SET scheduled_date = v_next_date, updated_at = NOW()
    WHERE id = p_payment_id;
  ELSE -- monthly
    v_next_date := v_payment.scheduled_date + interval '1 month';
    UPDATE public.scheduled_payments
    SET scheduled_date = v_next_date, updated_at = NOW()
    WHERE id = p_payment_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'debited_amount', v_payment.amount,
    'new_balance', v_new_balance,
    'frequency', v_payment.frequency,
    'next_date', v_next_date
  );
END;
$$;

-- Revoke execute from public/anon/authenticated and grant to service_role
REVOKE ALL ON FUNCTION public.process_scheduled_payment_atomic(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_scheduled_payment_atomic(uuid) TO service_role;


-- 3. Synchronize approved card_requests into cards table
CREATE OR REPLACE FUNCTION public.sync_card_request_to_cards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.status = 'aprovado' AND NEW.holder_name IS NOT NULL AND NEW.last4 IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.cards WHERE user_id = NEW.user_id AND last4 = NEW.last4) THEN
      UPDATE public.cards
      SET label = NEW.holder_name,
          credit_limit = COALESCE(NEW.credit_limit, 0),
          status = 'ativo',
          updated_at = NOW()
      WHERE user_id = NEW.user_id AND last4 = NEW.last4;
    ELSE
      INSERT INTO public.cards (
        user_id,
        label,
        last4,
        credit_limit,
        status,
        created_at,
        updated_at
      ) VALUES (
        NEW.user_id,
        NEW.holder_name,
        NEW.last4,
        COALESCE(NEW.credit_limit, 0),
        'ativo',
        NOW(),
        NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_card_request_to_cards ON public.card_requests;
CREATE TRIGGER trg_sync_card_request_to_cards
  AFTER UPDATE OF status, holder_name, last4, credit_limit ON public.card_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_card_request_to_cards();
