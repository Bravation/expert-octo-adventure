
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  data JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Allow system inserts via trigger (security definer functions)
-- No direct insert policy needed since triggers use SECURITY DEFINER

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: notify provider on new booking
CREATE OR REPLACE FUNCTION public.notify_provider_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _provider_user_id UUID;
  _customer_name TEXT;
  _service_title TEXT;
BEGIN
  SELECT user_id INTO _provider_user_id FROM profiles WHERE id = NEW.provider_id;
  SELECT full_name INTO _customer_name FROM profiles WHERE id = NEW.customer_id;
  SELECT title INTO _service_title FROM services WHERE id = NEW.service_id;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    _provider_user_id,
    'new_booking',
    'New Booking Request',
    _customer_name || ' booked "' || _service_title || '"',
    jsonb_build_object('booking_id', NEW.id, 'service_id', NEW.service_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_provider_new_booking();

-- Trigger function: notify provider on new review
CREATE OR REPLACE FUNCTION public.notify_provider_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _provider_user_id UUID;
  _reviewer_name TEXT;
  _service_title TEXT;
BEGIN
  SELECT user_id INTO _provider_user_id FROM profiles WHERE id = NEW.provider_id;
  SELECT full_name INTO _reviewer_name FROM profiles WHERE id = NEW.reviewer_id;
  SELECT title INTO _service_title FROM services WHERE id = NEW.service_id;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    _provider_user_id,
    'new_review',
    'New Review',
    _reviewer_name || ' left a ' || NEW.rating || '-star review on "' || _service_title || '"',
    jsonb_build_object('review_id', NEW.id, 'service_id', NEW.service_id, 'rating', NEW.rating)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_provider_new_review();
