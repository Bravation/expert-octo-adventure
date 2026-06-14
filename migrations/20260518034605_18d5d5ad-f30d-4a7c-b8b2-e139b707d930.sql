DROP VIEW IF EXISTS public.public_provider_service_areas;

CREATE VIEW public.public_provider_service_areas
WITH (security_invoker = true)
AS
SELECT
  id, provider_id, area_type, label, zip_code, city, state,
  ROUND(latitude::numeric, 2) AS latitude,
  ROUND(longitude::numeric, 2) AS longitude,
  radius_miles, is_active
FROM public.provider_service_areas
WHERE is_active = true;

GRANT SELECT ON public.public_provider_service_areas TO anon, authenticated;

-- Allow anon/authenticated to read base rows through the view (filtered to active)
CREATE POLICY "Public can view active service areas"
  ON public.provider_service_areas FOR SELECT
  TO anon, authenticated
  USING (is_active = true);