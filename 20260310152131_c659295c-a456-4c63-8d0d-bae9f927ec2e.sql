-- Remove security_invoker so the view bypasses RLS on profiles
-- This is safe because the view already limits columns (no email) and rounds GPS
ALTER VIEW public.public_provider_profiles SET (security_invoker = off);