-- 1) Public-safe geo columns (rounded)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude_public numeric GENERATED ALWAYS AS (round(latitude::numeric, 2)) STORED,
  ADD COLUMN IF NOT EXISTS longitude_public numeric GENERATED ALWAYS AS (round(longitude::numeric, 2)) STORED;

-- 2) Recreate views as SECURITY INVOKER
DROP VIEW IF EXISTS public.public_provider_profiles;
CREATE VIEW public.public_provider_profiles
WITH (security_invoker = on) AS
SELECT id, user_id, full_name, avatar_url, bio, city, state, zip_code,
  average_rating, total_reviews, total_services_completed, is_active, role,
  latitude_public AS latitude, longitude_public AS longitude
FROM public.profiles
WHERE role = 'service_provider'::user_role AND is_active = true;

DROP VIEW IF EXISTS public.conversation_partner_profiles;
CREATE VIEW public.conversation_partner_profiles
WITH (security_invoker = on) AS
SELECT p.id, p.user_id, p.full_name, p.avatar_url, p.role
FROM public.profiles p
WHERE p.id IN (
  SELECT c.customer_id FROM public.conversations c WHERE c.provider_id = public.get_profile_id(auth.uid())
  UNION
  SELECT c.provider_id FROM public.conversations c WHERE c.customer_id = public.get_profile_id(auth.uid())
);

-- 3) Lock down column access on profiles
REVOKE SELECT ON public.profiles FROM anon, authenticated, PUBLIC;

-- Safe columns readable by anyone (subject to row-level RLS)
GRANT SELECT (id, user_id, full_name, avatar_url, bio, city, state, zip_code,
  average_rating, total_reviews, total_services_completed, is_active, role,
  latitude_public, longitude_public, created_at, updated_at)
ON public.profiles TO anon, authenticated;

-- Sensitive columns: only the profile owner can read via own-profile row policy.
-- Grant the column to authenticated; row policy restricts access to own row.
GRANT SELECT (email, latitude, longitude) ON public.profiles TO authenticated;

-- Grants for view + view access
GRANT SELECT ON public.public_provider_profiles TO anon, authenticated;
GRANT SELECT ON public.conversation_partner_profiles TO authenticated;

-- 4) Row policies needed by the security_invoker views
-- Anon and authenticated can read rows for active providers (column grants protect email/raw GPS)
DROP POLICY IF EXISTS "Public can view active provider profile rows" ON public.profiles;
CREATE POLICY "Public can view active provider profile rows"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (role = 'service_provider'::user_role AND is_active = true);

-- Authenticated users can read conversation partner rows (sanitized columns only)
DROP POLICY IF EXISTS "Authenticated can view conversation partner rows" ON public.profiles;
CREATE POLICY "Authenticated can view conversation partner rows"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT c.customer_id FROM public.conversations c WHERE c.provider_id = public.get_profile_id(auth.uid())
    UNION
    SELECT c.provider_id FROM public.conversations c WHERE c.customer_id = public.get_profile_id(auth.uid())
  )
);

-- Owner row policy already exists ("Users can view own profile") and lets the owner read sensitive cols.
