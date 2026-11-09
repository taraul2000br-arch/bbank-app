DROP POLICY IF EXISTS "kyc users delete own pending" ON storage.objects;

CREATE POLICY "kyc users delete own when no submission"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND NOT EXISTS (
    SELECT 1 FROM public.kyc_submissions ks
    WHERE ks.user_id = auth.uid()
  )
);