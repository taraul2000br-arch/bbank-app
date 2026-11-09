-- ==============================================================================
-- Prepared Rollback Migration 13: Support, Documents & PII Security Rollback
-- Location: supabase/prepared/13_support_documents_security_rollback.sql
-- Description: Restores previous storage policies if needed.
-- ==============================================================================

-- 1. Drop hardened HMRC restrictions
DROP POLICY IF EXISTS "Block updates on hmrc-documents" ON storage.objects;
DROP POLICY IF EXISTS "Block deletes on hmrc-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own hmrc docs" ON storage.objects;
DROP POLICY IF EXISTS "Users read own hmrc docs" ON storage.objects;

-- 2. Drop hardened KYC restrictions
DROP POLICY IF EXISTS "kyc users delete own when no submission" ON storage.objects;
DROP POLICY IF EXISTS "kyc users delete own" ON storage.objects;
DROP POLICY IF EXISTS "kyc users upload own" ON storage.objects;
DROP POLICY IF EXISTS "kyc users read own" ON storage.objects;

-- 3. Restore previous HMRC documents policy (with blanket admin check)
CREATE POLICY "Users read own hmrc docs" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'hmrc-documents' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR get_admin_level(auth.uid()) IS NOT NULL
    )
  );

CREATE POLICY "Users upload own hmrc docs" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'hmrc-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
