
-- Block DELETE on hmrc-documents bucket files
DROP POLICY IF EXISTS "Block deletes on hmrc-documents" ON storage.objects;
CREATE POLICY "Block deletes on hmrc-documents"
ON storage.objects AS RESTRICTIVE
FOR DELETE
USING (bucket_id <> 'hmrc-documents');

-- Block UPDATE on hmrc-documents bucket files
DROP POLICY IF EXISTS "Block updates on hmrc-documents" ON storage.objects;
CREATE POLICY "Block updates on hmrc-documents"
ON storage.objects AS RESTRICTIVE
FOR UPDATE
USING (bucket_id <> 'hmrc-documents')
WITH CHECK (bucket_id <> 'hmrc-documents');

-- Block all DELETE on kyc_submissions table
DROP POLICY IF EXISTS "Block deletes on kyc_submissions" ON public.kyc_submissions;
CREATE POLICY "Block deletes on kyc_submissions"
ON public.kyc_submissions AS RESTRICTIVE
FOR DELETE
USING (false);

-- Replace login events admin SELECT policy to cover all admin levels
DROP POLICY IF EXISTS "Admins can view all login events" ON public.user_login_events;
CREATE POLICY "Admins view login events in scope"
ON public.user_login_events
FOR SELECT
USING (public.can_admin_see(auth.uid(), user_id));
