-- Update provider commission tiers: 15% max, 5% min, drop 1% every 20 completed bookings

-- Update default for new providers
ALTER TABLE public.provider_milestones
  ALTER COLUMN current_commission_rate SET DEFAULT 15.00;

-- Recalculate existing rates based on new formula
UPDATE public.provider_milestones
SET current_commission_rate = GREATEST(5.00, 15.00 - FLOOR(completed_bookings / 20.0)),
    updated_at = now();

-- Replace booking completion trigger function with new tier logic
CREATE OR REPLACE FUNCTION public.handle_booking_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_rate DECIMAL(5,2);
  new_completed INTEGER;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT current_commission_rate INTO current_rate
    FROM public.provider_milestones
    WHERE provider_id = NEW.provider_id;

    IF current_rate IS NULL THEN
      current_rate := 15.00;
    END IF;

    NEW.commission_rate := current_rate;
    NEW.commission_amount := NEW.total_price * (current_rate / 100);

    UPDATE public.provider_milestones
    SET completed_bookings = completed_bookings + 1,
        current_commission_rate = GREATEST(5.00, current_commission_rate -
          CASE WHEN (completed_bookings + 1) % 20 = 0 THEN 1.00 ELSE 0 END),
        updated_at = now()
    WHERE provider_id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update provider milestone notification to reflect 20-booking cadence
CREATE OR REPLACE FUNCTION public.notify_provider_milestone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _provider_user_id UUID;
  _old_rate numeric(5,2);
  _new_rate numeric(5,2);
BEGIN
  IF NEW.completed_bookings >= 20
    AND (OLD.completed_bookings IS NULL OR FLOOR(NEW.completed_bookings / 20.0) > FLOOR(OLD.completed_bookings / 20.0))
    AND NEW.current_commission_rate < OLD.current_commission_rate
  THEN
    SELECT user_id INTO _provider_user_id FROM profiles WHERE id = NEW.provider_id;
    _old_rate := OLD.current_commission_rate;
    _new_rate := NEW.current_commission_rate;

    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      _provider_user_id,
      'milestone',
      'Milestone Reached! 🎉',
      'You completed ' || NEW.completed_bookings || ' bookings! Your commission rate dropped from ' || _old_rate || '% to ' || _new_rate || '%.',
      jsonb_build_object(
        'completed_bookings', NEW.completed_bookings,
        'old_rate', _old_rate,
        'new_rate', _new_rate,
        'title_es', '¡Hito Alcanzado! 🎉',
        'message_es', 'Completaste ' || NEW.completed_bookings || ' reservas. Tu comisión bajó de ' || _old_rate || '% a ' || _new_rate || '%.'
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;