
-- Reuse withdrawal_status enum (solicitado/aprovado/recusado)
CREATE TABLE public.transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  beneficiary_name text NOT NULL,
  beneficiary_doc text NOT NULL,
  beneficiary_email text NOT NULL,
  bank_name text NOT NULL,
  swift text NOT NULL,
  account_number text NOT NULL,
  to_country text NOT NULL,
  currency_from text NOT NULL,
  currency_to text NOT NULL,
  amount numeric NOT NULL,
  fx_rate numeric NOT NULL,
  converted_amount numeric NOT NULL,
  purpose text NOT NULL,
  reference text NOT NULL,
  hmrc_doc_path text,
  status withdrawal_status NOT NULL DEFAULT 'solicitado',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own transfers"
  ON public.transfer_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own transfers"
  ON public.transfer_requests FOR SELECT
  USING ((auth.uid() = user_id) OR can_admin_see(auth.uid(), user_id));

CREATE POLICY "Admins update transfers"
  ON public.transfer_requests FOR UPDATE
  USING (can_admin_see(auth.uid(), user_id));

CREATE TRIGGER trg_transfer_requests_updated
  BEFORE UPDATE ON public.transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for HMRC documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('hmrc-documents', 'hmrc-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own hmrc docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'hmrc-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own hmrc docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'hmrc-documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR get_admin_level(auth.uid()) IS NOT NULL
    )
  );
