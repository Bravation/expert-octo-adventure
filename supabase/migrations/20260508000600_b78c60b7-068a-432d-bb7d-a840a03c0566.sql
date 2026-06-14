-- Fix: handle_new_user should not trust client-supplied role; allowlist only valid signup roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' IN ('customer','service_provider')
        THEN (NEW.raw_user_meta_data->>'role')::user_role
      ELSE 'customer'::user_role
    END
  );
  RETURN NEW;
END;
$function$;

-- Fix: Restrict profiles SELECT to authenticated/owner only.
-- Public provider listings must come from the public_provider_profiles view
-- (which excludes email and rounds geolocation).
-- Make the public view security_invoker so the underlying RLS does not block anon,
-- and grant explicit read access on the view.
ALTER VIEW public.public_provider_profiles SET (security_invoker = on);

-- Allow anon and authenticated to read the sanitized public view
GRANT SELECT ON public.public_provider_profiles TO anon, authenticated;

-- Add a permissive SELECT policy on profiles so the security_invoker view
-- can return active provider rows to anon, but ONLY for the sanitized columns
-- exposed by the view. Since RLS is row-level, we still must allow the rows;
-- column protection is enforced by the view itself (which never selects email,
-- raw latitude, or raw longitude).
CREATE POLICY "Public can view active provider rows via sanitized view"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (role = 'service_provider'::user_role AND is_active = true);

-- Revoke direct table SELECT from anon to prevent bypassing the view.
-- (Postgrest still honors RLS; the policy above means anon CAN read provider rows
-- directly including email. To fully prevent that, we revoke table-level grants
-- from anon and only grant view access.)
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
