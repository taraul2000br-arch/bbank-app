-- ==============================================================================
-- Rollback Migration 14: Scheduled Payments & Credit Cards Functional Hardening
-- Location: supabase/prepared/14_scheduled_payments_and_credit_cards_rollback.sql
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_sync_card_request_to_cards ON public.card_requests;
DROP FUNCTION IF EXISTS public.sync_card_request_to_cards();
DROP FUNCTION IF EXISTS public.process_scheduled_payment_atomic(uuid);
DROP INDEX IF EXISTS idx_scheduled_payments_due;
