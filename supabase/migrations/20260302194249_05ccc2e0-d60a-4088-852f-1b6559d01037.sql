
-- Add location fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS state TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS zip_code TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add photo to services
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '';

-- Create reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(booking_id, reviewer_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Customers can create reviews for completed bookings" ON public.reviews FOR INSERT
  WITH CHECK (
    reviewer_id = get_profile_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.status = 'completed' AND b.customer_id = reviewer_id
    )
  );

-- Add average rating cache to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_services_completed INTEGER DEFAULT 0;

-- Function to update provider rating on new review
CREATE OR REPLACE FUNCTION public.update_provider_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET average_rating = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE provider_id = NEW.provider_id),
      total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE provider_id = NEW.provider_id)
  WHERE id = NEW.provider_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_provider_rating
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_provider_rating();

-- Custom quotes table
CREATE TABLE public.custom_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  custom_price NUMERIC NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can view their quotes" ON public.custom_quotes FOR SELECT
  USING (provider_id = get_profile_id(auth.uid()));
CREATE POLICY "Customers can view their quotes" ON public.custom_quotes FOR SELECT
  USING (customer_id = get_profile_id(auth.uid()));
CREATE POLICY "Customers can request quotes" ON public.custom_quotes FOR INSERT
  WITH CHECK (customer_id = get_profile_id(auth.uid()));
CREATE POLICY "Providers can update quote status" ON public.custom_quotes FOR UPDATE
  USING (provider_id = get_profile_id(auth.uid()));

-- Provider availability / calendar
CREATE TABLE public.provider_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(provider_id, day_of_week)
);

ALTER TABLE public.provider_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view provider availability" ON public.provider_availability FOR SELECT USING (true);
CREATE POLICY "Providers can manage own availability" ON public.provider_availability FOR INSERT
  WITH CHECK (provider_id = get_profile_id(auth.uid()));
CREATE POLICY "Providers can update own availability" ON public.provider_availability FOR UPDATE
  USING (provider_id = get_profile_id(auth.uid()));
CREATE POLICY "Providers can delete own availability" ON public.provider_availability FOR DELETE
  USING (provider_id = get_profile_id(auth.uid()));

-- Add scheduling fields to bookings
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS scheduled_date DATE,
ADD COLUMN IF NOT EXISTS scheduled_time TIME,
ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(4,1) DEFAULT 1;

-- Allow unauthenticated users to view available services (for browsing)
DROP POLICY IF EXISTS "Anyone authenticated can view available services" ON public.services;
CREATE POLICY "Anyone can view available services" ON public.services FOR SELECT
  USING (status = 'available'::service_status);

-- Make provider profiles viewable publicly for the marketplace
DROP POLICY IF EXISTS "Users can view active provider profiles" ON public.profiles;
CREATE POLICY "Anyone can view active provider profiles" ON public.profiles FOR SELECT
  USING ((role = 'service_provider'::user_role) AND (is_active = true));
