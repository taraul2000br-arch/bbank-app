ALTER TABLE public.transfer_requests
  ALTER COLUMN hmrc_doc_path DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;