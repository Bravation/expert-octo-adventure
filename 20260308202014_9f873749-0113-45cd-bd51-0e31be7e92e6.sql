
-- Allow users to see profiles of people they have conversations with
CREATE POLICY "Conversation participants can view each other"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT customer_id FROM public.conversations
      WHERE provider_id = get_profile_id(auth.uid())
      UNION
      SELECT provider_id FROM public.conversations
      WHERE customer_id = get_profile_id(auth.uid())
    )
  );
