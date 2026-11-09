
-- KYC status enum
DO $$ BEGIN
  CREATE TYPE public.kyc_status AS ENUM ('not_started','pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status public.kyc_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_by uuid;

-- Submissions table
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  statement1_path text NOT NULL,
  statement2_path text NOT NULL,
  liveness_paths text[] NOT NULL DEFAULT '{}',
  status public.kyc_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own kyc" ON public.kyc_submissions;
CREATE POLICY "Users view own kyc" ON public.kyc_submissions FOR SELECT
  USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users insert own kyc" ON public.kyc_submissions;
CREATE POLICY "Users insert own kyc" ON public.kyc_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update kyc" ON public.kyc_submissions;
CREATE POLICY "Admins update kyc" ON public.kyc_submissions FOR UPDATE
  USING (public.can_admin_see(auth.uid(), user_id));

CREATE TRIGGER trg_kyc_submissions_updated
  BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update handle_new_user to set kyc_status not_started (already default; ensure)
-- (no change needed since default applies)

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents','kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "kyc users read own" ON storage.objects;
CREATE POLICY "kyc users read own" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-documents' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.can_admin_see(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS "kyc users upload own" ON storage.objects;
CREATE POLICY "kyc users upload own" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "kyc users delete own" ON storage.objects;
CREATE POLICY "kyc users delete own" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'kyc-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
