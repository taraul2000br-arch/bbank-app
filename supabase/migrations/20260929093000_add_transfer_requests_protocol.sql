-- Migration: Add persistent protocol column to transfer_requests
-- Requisitos:
-- 1. Protocolo único quando preenchido
-- 2. Não destruir dados existentes (coluna nullable)
-- 3. Não reutilizar reference
-- 4. Registros antigos mantêm NULL e são exibidos como "Not available"

ALTER TABLE public.transfer_requests
  ADD COLUMN IF NOT EXISTS protocol text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_requests_protocol
  ON public.transfer_requests (protocol)
  WHERE protocol IS NOT NULL;
