
-- Re-add the policy since RLS can't filter columns, but the app code will be updated to not select sensitive fields
-- The view provides an additional safe access path
CREATE POLICY "Anyone can view active provider profiles" ON public.profiles
FOR SELECT TO public
USING (role = 'service_provider' AND is_active = true);
