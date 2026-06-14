-- Revert security_invoker so the view runs as its owner and can read profiles
ALTER VIEW public.public_provider_profiles SET (security_invoker = off);

-- Drop the public-row policy added previously; not needed when view is definer
DROP POLICY IF EXISTS "Public can view active provider rows via sanitized view" ON public.profiles;
