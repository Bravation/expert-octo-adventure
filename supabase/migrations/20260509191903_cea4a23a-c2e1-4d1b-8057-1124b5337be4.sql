
-- 1. service-photos bucket: restrict uploads to user's own folder
DROP POLICY IF EXISTS "Authenticated users can upload service photos" ON storage.objects;
CREATE POLICY "Users can upload service photos to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'service-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. profiles: drop the broad conversation-partner SELECT policy
-- (the app already reads partner info via the conversation_partner_profiles view)
DROP POLICY IF EXISTS "Authenticated can view conversation partner rows" ON public.profiles;

-- Tighten own-profile policies to authenticated role only
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. Re-scope write policies from public to authenticated
-- conversations
DROP POLICY IF EXISTS "Participants can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can create conversations"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (customer_id = get_profile_id(auth.uid()) OR provider_id = get_profile_id(auth.uid()));
CREATE POLICY "Participants can update conversations"
ON public.conversations FOR UPDATE TO authenticated
USING (customer_id = get_profile_id(auth.uid()) OR provider_id = get_profile_id(auth.uid()));
CREATE POLICY "Participants can view conversations"
ON public.conversations FOR SELECT TO authenticated
USING (customer_id = get_profile_id(auth.uid()) OR provider_id = get_profile_id(auth.uid()));

-- messages
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
DROP POLICY IF EXISTS "Recipients can mark messages read" ON public.messages;
DROP POLICY IF EXISTS "Users can read own realtime topic" ON public.messages;
DROP POLICY IF EXISTS "Users can write own realtime topic" ON public.messages;
CREATE POLICY "Participants can send messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = get_profile_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND (c.customer_id = get_profile_id(auth.uid()) OR c.provider_id = get_profile_id(auth.uid()))
  )
);
CREATE POLICY "Participants can view messages"
ON public.messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND (c.customer_id = get_profile_id(auth.uid()) OR c.provider_id = get_profile_id(auth.uid()))
  )
);
CREATE POLICY "Recipients can mark messages read"
ON public.messages FOR UPDATE TO authenticated
USING (
  sender_id <> get_profile_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND (c.customer_id = get_profile_id(auth.uid()) OR c.provider_id = get_profile_id(auth.uid()))
  )
);

-- custom_quotes
DROP POLICY IF EXISTS "Customers can request quotes" ON public.custom_quotes;
DROP POLICY IF EXISTS "Customers can view their quotes" ON public.custom_quotes;
DROP POLICY IF EXISTS "Providers can update quote status" ON public.custom_quotes;
DROP POLICY IF EXISTS "Providers can view their quotes" ON public.custom_quotes;
CREATE POLICY "Customers can request quotes"
ON public.custom_quotes FOR INSERT TO authenticated
WITH CHECK (customer_id = get_profile_id(auth.uid()));
CREATE POLICY "Customers can view their quotes"
ON public.custom_quotes FOR SELECT TO authenticated
USING (customer_id = get_profile_id(auth.uid()));
CREATE POLICY "Providers can update quote status"
ON public.custom_quotes FOR UPDATE TO authenticated
USING (provider_id = get_profile_id(auth.uid()));
CREATE POLICY "Providers can view their quotes"
ON public.custom_quotes FOR SELECT TO authenticated
USING (provider_id = get_profile_id(auth.uid()));

-- provider_availability writes
DROP POLICY IF EXISTS "Providers can manage own availability" ON public.provider_availability;
DROP POLICY IF EXISTS "Providers can update own availability" ON public.provider_availability;
DROP POLICY IF EXISTS "Providers can delete own availability" ON public.provider_availability;
CREATE POLICY "Providers can manage own availability"
ON public.provider_availability FOR INSERT TO authenticated
WITH CHECK (provider_id = get_profile_id(auth.uid()));
CREATE POLICY "Providers can update own availability"
ON public.provider_availability FOR UPDATE TO authenticated
USING (provider_id = get_profile_id(auth.uid()));
CREATE POLICY "Providers can delete own availability"
ON public.provider_availability FOR DELETE TO authenticated
USING (provider_id = get_profile_id(auth.uid()));

-- push_subscriptions: tighten to authenticated
DROP POLICY IF EXISTS "Users can create own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can create own push subscriptions"
ON public.push_subscriptions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions FOR DELETE TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Users can update own push subscriptions"
ON public.push_subscriptions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 4. realtime.messages: ensure RLS is enabled (deny-by-default for broadcast/presence)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
