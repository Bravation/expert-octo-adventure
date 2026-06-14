-- 1) Profile circular role check -> rely on prevent_role_change trigger
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2) Conversation partner exposure: remove broad SELECT, add sanitized view
DROP POLICY IF EXISTS "Conversation participants can view each other" ON public.profiles;

CREATE OR REPLACE VIEW public.conversation_partner_profiles AS
SELECT
  p.id,
  p.user_id,
  p.full_name,
  p.avatar_url,
  p.role
FROM public.profiles p
WHERE p.id IN (
  SELECT c.customer_id FROM public.conversations c WHERE c.provider_id = public.get_profile_id(auth.uid())
  UNION
  SELECT c.provider_id FROM public.conversations c WHERE c.customer_id = public.get_profile_id(auth.uid())
);

GRANT SELECT ON public.conversation_partner_profiles TO authenticated;

-- 3) Storage: restrict service-photos uploads to caller's own folder
DROP POLICY IF EXISTS "Authenticated users can upload service photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload service photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'service-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4) Realtime: restrict broadcast/presence channels by topic = auth.uid()
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own realtime topic" ON realtime.messages;
CREATE POLICY "Users can read own realtime topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can write own realtime topic" ON realtime.messages;
CREATE POLICY "Users can write own realtime topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = auth.uid()::text
);
