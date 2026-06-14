-- Public buckets serve object reads through the public URL endpoint, which bypasses RLS.
-- The existing broad SELECT policies on storage.objects let anyone enumerate (list) every
-- file in these buckets via the storage list API. Drop them so listing is blocked while
-- direct public URL fetches keep working because the buckets are flagged public.

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view service photos" ON storage.objects;

-- Allow owners to list/inspect only their own files (folder = their auth.uid()).
CREATE POLICY "Users can list own avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can list own service photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'service-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
