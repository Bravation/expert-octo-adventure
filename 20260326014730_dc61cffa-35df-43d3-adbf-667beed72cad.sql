
CREATE OR REPLACE FUNCTION public.update_customer_milestone_on_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _positive_count integer;
  _new_fee numeric(5,2);
BEGIN
  IF NEW.rating >= 4 THEN
    INSERT INTO public.customer_milestones (customer_id)
    VALUES (NEW.reviewer_id)
    ON CONFLICT (customer_id) DO NOTHING;

    SELECT COUNT(*) INTO _positive_count
    FROM public.reviews
    WHERE reviewer_id = NEW.reviewer_id AND rating >= 4;

    _new_fee := GREATEST(3.00, 10.00 - FLOOR(_positive_count / 10.0));

    UPDATE public.customer_milestones
    SET positive_reviews = _positive_count,
        current_booking_fee_percentage = _new_fee,
        updated_at = now()
    WHERE customer_id = NEW.reviewer_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_booking_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    NEW.commission_rate := current_rate;
    NEW.commission_amount := NEW.total_price * (current_rate / 100);

    UPDATE public.provider_milestones
    SET completed_bookings = completed_bookings + 1,
        current_commission_rate = GREATEST(3.00, current_commission_rate - 
          CASE WHEN (completed_bookings + 1) % 10 = 0 THEN 1.00 ELSE 0 END),
        updated_at = now()
    WHERE provider_id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$function$;
