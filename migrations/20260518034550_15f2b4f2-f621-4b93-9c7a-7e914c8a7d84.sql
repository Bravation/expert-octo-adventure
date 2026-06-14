-- Provider service areas: lets providers define where they accept jobs
CREATE TABLE public.provider_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  area_type text NOT NULL CHECK (area_type IN ('radius','zip','region')),
  label text NOT NULL DEFAULT '',
  zip_code text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  latitude double precision,
  longitude double precision,
  radius_miles numeric(6,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_psa_provider ON public.provider_service_areas(provider_id);
CREATE INDEX idx_psa_zip ON public.provider_service_areas(zip_code) WHERE area_type = 'zip';

ALTER TABLE public.provider_service_areas ENABLE ROW LEVEL SECURITY;

-- Providers manage their own areas
CREATE POLICY "Providers can view own service areas"
  ON public.provider_service_areas FOR SELECT
  TO authenticated
  USING (provider_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Providers can insert own service areas"
  ON public.provider_service_areas FOR INSERT
  TO authenticated
  WITH CHECK (provider_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Providers can update own service areas"
  ON public.provider_service_areas FOR UPDATE
  TO authenticated
  USING (provider_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Providers can delete own service areas"
  ON public.provider_service_areas FOR DELETE
  TO authenticated
  USING (provider_id = public.get_profile_id(auth.uid()));

-- Public sanitized view: rounds coordinates to 2 decimals (~1 mile), matches GPS policy
CREATE OR REPLACE VIEW public.public_provider_service_areas
WITH (security_invoker = false)
AS
SELECT
  id,
  provider_id,
  area_type,
  label,
  zip_code,
  city,
  state,
  ROUND(latitude::numeric, 2) AS latitude,
  ROUND(longitude::numeric, 2) AS longitude,
  radius_miles,
  is_active
FROM public.provider_service_areas
WHERE is_active = true;

GRANT SELECT ON public.public_provider_service_areas TO anon, authenticated;

CREATE TRIGGER update_provider_service_areas_updated_at
BEFORE UPDATE ON public.provider_service_areas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();