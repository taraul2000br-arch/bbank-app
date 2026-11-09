ALTER TABLE public.card_requests
  ADD COLUMN IF NOT EXISTS card_number text,
  ADD COLUMN IF NOT EXISTS expiry text,
  ADD COLUMN IF NOT EXISTS cvc text;