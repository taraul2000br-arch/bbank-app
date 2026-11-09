-- ==============================================================================
-- Prepared Migration 13: Support, Documents & PII Security
-- Location: supabase/prepared/13_support_documents_security.sql
-- Description:
--   1. Ensures storage buckets 'kyc-documents' and 'hmrc-documents' exist and are strictly PRIVATE.
--   2. Sets 10MB file size limit and enforces allowed MIME types on both buckets.
--   3. Hardens storage.objects RLS policies:
--      - Fixes HMRC documents SELECT policy: replaces blanket admin access
--        with portfolio-scoped check (public.can_admin_see).
--      - Retains user-isolated folder enforcement: auth.uid() = (storage.foldername(name))[1].
--      - Restricts deletes and updates to maintain audit compliance.
--      - Revokes storage.objects access from anon.
-- NOTE: DO NOT EXECUTE REMOTELY WITHOUT EXPLICIT USER AUTHORIZATION.
-- ==============================================================================

-- 1. Private Buckets Creation with Size and MIME Restrictions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'video/webm', 'video/mp4']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'video/webm', 'video/mp4']::text[];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hmrc-documents',
  'hmrc-documents',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[];


-- 2. KYC Documents Storage RLS Hardening
DROP POLICY IF EXISTS "kyc users read own" ON storage.objects;
CREATE POLICY "kyc users read own" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-documents' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND public.can_admin_see(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "kyc users upload own" ON storage.objects;
CREATE POLICY "kyc users upload own" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "kyc users delete own" ON storage.objects;
DROP POLICY IF EXISTS "kyc users delete own when no submission" ON storage.objects;
CREATE POLICY "kyc users delete own when no submission" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'kyc-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND NOT EXISTS (
      SELECT 1 FROM public.kyc_submissions WHERE user_id = auth.uid()
    )
  );


-- 3. HMRC Documents Storage RLS Hardening (Fix Blanket Admin Bypass)
DROP POLICY IF EXISTS "Users read own hmrc docs" ON storage.objects;
CREATE POLICY "Users read own hmrc docs" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'hmrc-documents' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND public.can_admin_see(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "Users upload own hmrc docs" ON storage.objects;
CREATE POLICY "Users upload own hmrc docs" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'hmrc-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Block deletes on hmrc-documents" ON storage.objects;
CREATE POLICY "Block deletes on hmrc-documents" ON storage.objects AS RESTRICTIVE
  FOR DELETE
  USING (bucket_id <> 'hmrc-documents');

DROP POLICY IF EXISTS "Block updates on hmrc-documents" ON storage.objects;
CREATE POLICY "Block updates on hmrc-documents" ON storage.objects AS RESTRICTIVE
  FOR UPDATE
  USING (bucket_id <> 'hmrc-documents')
  WITH CHECK (bucket_id <> 'hmrc-documents');

-- 4. Storage Objects Revoke from Anon
REVOKE ALL ON storage.objects FROM anon;
