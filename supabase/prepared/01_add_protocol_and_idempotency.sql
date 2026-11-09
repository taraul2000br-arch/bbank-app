-- ==============================================================================
-- Prepared Migration 01: Protocol and Idempotency Key
-- Location: supabase/prepared/01_add_protocol_and_idempotency.sql
-- Description: Adds protocol and idempotency_key columns with partial unique indexes.
-- Idempotent and safe for execution in test or staging environments.
-- ==============================================================================

ALTER TABLE public.transfer_requests
  ADD COLUMN IF NOT EXISTS protocol text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_requests_protocol
  ON public.transfer_requests (protocol)
  WHERE protocol IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_requests_user_idempotency
  ON public.transfer_requests (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
