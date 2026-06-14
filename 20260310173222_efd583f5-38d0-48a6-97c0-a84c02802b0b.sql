
-- Allow admins to view all suggestions
CREATE POLICY "Admins can view all suggestions"
ON public.suggestions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any suggestion (e.g. change status)
CREATE POLICY "Admins can update all suggestions"
ON public.suggestions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
