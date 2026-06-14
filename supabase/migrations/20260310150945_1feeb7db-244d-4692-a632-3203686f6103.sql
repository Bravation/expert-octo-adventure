
-- 1. Drop the public policy that exposes email
DROP POLICY IF EXISTS "Anyone can view active provider profiles" ON public.profiles;

-- 2. Add WITH CHECK to prevent role changes via update policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid()));

-- 3. Restrict conversation participants policy to not expose email
DROP POLICY IF EXISTS "Conversation participants can view each other" ON public.profiles;
CREATE POLICY "Conversation participants can view each other" ON public.profiles
FOR SELECT TO public
USING (
  id IN (
    SELECT conversations.customer_id FROM conversations WHERE conversations.provider_id = get_profile_id(auth.uid())
    UNION
    SELECT conversations.provider_id FROM conversations WHERE conversations.customer_id = get_profile_id(auth.uid())
  )
);
