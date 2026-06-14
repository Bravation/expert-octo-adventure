-- Lock down profiles: remove broad public-readable policy that exposed email/lat/lng
DROP POLICY IF EXISTS "Public can view active provider profile rows" ON public.profiles;

-- Recreate the safe public view as SECURITY DEFINER (owner-bypasses RLS)
-- so anon/authenticated can still read sanitized provider info, but never email.
DROP VIEW IF EXISTS public.public_provider_profiles;

CREATE VIEW public.public_provider_profiles
WITH (security_invoker = off) AS
SELECT
  id,
  user_id,
  full_name,
  avatar_url,
  bio,
  city,
  state,
  zip_code,
  average_rating,
  total_reviews,
  total_services_completed,
  is_active,
  role,
  latitude_public  AS latitude,
  longitude_public AS longitude
FROM public.profiles
WHERE role = 'service_provider'::user_role
  AND is_active = true;

GRANT SELECT ON public.public_provider_profiles TO anon, authenticated;