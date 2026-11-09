-- 1) HMRC docs: scope admin reads per hierarchy
DROP POLICY IF EXISTS "Users read own hmrc docs" ON storage.objects;
CREATE POLICY "Users read own hmrc docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'hmrc-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.can_admin_see(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

-- 2) Cards: allow scoped admins to update
DROP POLICY IF EXISTS "Admins manage cards" ON public.cards;
CREATE POLICY "Admins update cards in scope"
ON public.cards FOR UPDATE
USING (public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Admins delete cards" ON public.cards;
CREATE POLICY "Admins delete cards in scope"
ON public.cards FOR DELETE
USING (public.can_admin_see(auth.uid(), user_id));

-- 3) KYC: users can only delete their own files while submission is pending or none exists
DROP POLICY IF EXISTS "kyc users delete own" ON storage.objects;
CREATE POLICY "kyc users delete own pending"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND NOT EXISTS (
    SELECT 1 FROM public.kyc_submissions ks
    WHERE ks.user_id = auth.uid()
      AND ks.status <> 'pending'
  )
);

-- 4) KYC bucket: explicitly block updates on objects
CREATE POLICY "kyc no updates"
ON storage.objects AS RESTRICTIVE
FOR UPDATE
USING (bucket_id <> 'kyc-documents')
WITH CHECK (bucket_id <> 'kyc-documents');

-- 5) user_login_events: explicit restrictive INSERT/DELETE blocks
CREATE POLICY "Block client inserts on login events"
ON public.user_login_events AS RESTRICTIVE
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Block client deletes on login events"
ON public.user_login_events AS RESTRICTIVE
FOR DELETE
USING (false);