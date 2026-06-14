
-- Create a security definer function to get user role without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role_secure(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Drop and recreate the UPDATE policy to use the security definer function
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (
  (auth.uid() = user_id)
  AND (role = get_user_role_secure(auth.uid()))
);
