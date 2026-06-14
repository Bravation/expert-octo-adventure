
-- 1. ROLE ESCALATION: Prevent users from changing their own role
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Changing your own role is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_role_change_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_change();

-- 2. EXPOSED EMAILS & GPS: Create a public view with limited columns and rounded GPS
CREATE OR REPLACE VIEW public.public_provider_profiles AS
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
  ROUND(latitude::numeric, 2) AS latitude,
  ROUND(longitude::numeric, 2) AS longitude
FROM public.profiles
WHERE role = 'service_provider' AND is_active = true;

-- Grant access to the view
GRANT SELECT ON public.public_provider_profiles TO anon, authenticated;

-- 3. Drop the overly permissive policy that exposes all columns
DROP POLICY IF EXISTS "Anyone can view active provider profiles" ON public.profiles;
