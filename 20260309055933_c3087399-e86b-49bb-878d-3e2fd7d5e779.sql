
-- Update completion trigger: commission applies to total (booking fee + service price)
CREATE OR REPLACE FUNCTION public.handle_booking_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_rate DECIMAL(5,2);
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT current_commission_rate INTO current_rate
    FROM public.provider_milestones
    WHERE provider_id = NEW.provider_id;

    IF current_rate IS NULL THEN
      current_rate := 10.00;
    END IF;

    -- Commission applies to total price (booking fee + service price)
    NEW.commission_rate := current_rate;
    NEW.commission_amount := NEW.total_price * (current_rate / 100);

    UPDATE public.provider_milestones
    SET completed_bookings = completed_bookings + 1,
        current_commission_rate = GREATEST(1.00, current_commission_rate - 
          CASE WHEN (completed_bookings + 1) % 10 = 0 THEN 1.00 ELSE 0 END),
        updated_at = now()
    WHERE provider_id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$$;
