
-- Add booking fee and payment tracking columns to bookings
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS booking_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booking_fee_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS service_payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS booking_fee_percentage numeric NOT NULL DEFAULT 5.00;

-- Create price_adjustments table
CREATE TABLE public.price_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  proposed_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  old_price numeric NOT NULL,
  new_price numeric NOT NULL,
  reason text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.price_adjustments ENABLE ROW LEVEL SECURITY;

-- Both customer and provider of the booking can view price adjustments
CREATE POLICY "Booking participants can view price adjustments"
ON public.price_adjustments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = price_adjustments.booking_id
    AND (b.customer_id = get_profile_id(auth.uid()) OR b.provider_id = get_profile_id(auth.uid()))
  )
);

-- Either party can propose adjustments
CREATE POLICY "Booking participants can create price adjustments"
ON public.price_adjustments
FOR INSERT
TO authenticated
WITH CHECK (
  proposed_by = get_profile_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = price_adjustments.booking_id
    AND (b.customer_id = get_profile_id(auth.uid()) OR b.provider_id = get_profile_id(auth.uid()))
  )
);

-- The other party can accept/reject
CREATE POLICY "Booking participants can update price adjustments"
ON public.price_adjustments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = price_adjustments.booking_id
    AND (b.customer_id = get_profile_id(auth.uid()) OR b.provider_id = get_profile_id(auth.uid()))
  )
);

-- Create trigger to notify on price adjustment
CREATE OR REPLACE FUNCTION public.notify_price_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _booking RECORD;
  _proposer_name TEXT;
  _other_user_id UUID;
BEGIN
  SELECT * INTO _booking FROM bookings WHERE id = NEW.booking_id;
  SELECT full_name INTO _proposer_name FROM profiles WHERE id = NEW.proposed_by;
  
  -- Notify the other party
  IF NEW.proposed_by = _booking.customer_id THEN
    SELECT user_id INTO _other_user_id FROM profiles WHERE id = _booking.provider_id;
  ELSE
    SELECT user_id INTO _other_user_id FROM profiles WHERE id = _booking.customer_id;
  END IF;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    _other_user_id,
    'price_adjustment',
    'Price Adjustment Proposed',
    _proposer_name || ' proposed a price change from $' || NEW.old_price::text || ' to $' || NEW.new_price::text,
    jsonb_build_object('booking_id', NEW.booking_id, 'adjustment_id', NEW.id, 'old_price', NEW.old_price, 'new_price', NEW.new_price)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_price_adjustment_created
AFTER INSERT ON public.price_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.notify_price_adjustment();

-- Trigger to update booking price when adjustment is accepted
CREATE OR REPLACE FUNCTION public.handle_price_adjustment_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    UPDATE bookings 
    SET service_price = NEW.new_price,
        total_price = NEW.new_price + booking_fee,
        booking_fee_percentage = (SELECT booking_fee_percentage FROM bookings WHERE id = NEW.booking_id)
    WHERE id = NEW.booking_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_price_adjustment_accepted
AFTER UPDATE ON public.price_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.handle_price_adjustment_accepted();
