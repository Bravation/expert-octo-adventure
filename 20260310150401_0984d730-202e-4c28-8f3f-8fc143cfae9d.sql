
-- Fix security definer view by setting it to SECURITY INVOKER
ALTER VIEW public.public_provider_profiles SET (security_invoker = on);
