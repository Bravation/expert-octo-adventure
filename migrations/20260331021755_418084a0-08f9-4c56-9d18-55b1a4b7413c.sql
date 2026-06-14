-- Update customer milestone notification to include bilingual text
CREATE OR REPLACE FUNCTION public.notify_customer_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer_user_id UUID;
  _old_fee numeric(5,2);
  _new_fee numeric(5,2);
BEGIN
  IF NEW.positive_reviews >= 10
    AND (OLD.positive_reviews IS NULL OR FLOOR(NEW.positive_reviews / 10.0) > FLOOR(OLD.positive_reviews / 10.0))
    AND NEW.current_booking_fee_percentage < OLD.current_booking_fee_percentage
  THEN
    SELECT user_id INTO _customer_user_id FROM profiles WHERE id = NEW.customer_id;
    _old_fee := OLD.current_booking_fee_percentage;
    _new_fee := NEW.current_booking_fee_percentage;

    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      _customer_user_id,
      'milestone',
      'Milestone Reached! 🎉',
      'You reached ' || NEW.positive_reviews || ' positive reviews! Your booking fee dropped from ' || _old_fee || '% to ' || _new_fee || '%.',
      jsonb_build_object(
        'positive_reviews', NEW.positive_reviews,
        'old_fee', _old_fee,
        'new_fee', _new_fee,
        'title_es', '¡Hito Alcanzado! 🎉',
        'message_es', 'Alcanzaste ' || NEW.positive_reviews || ' reseñas positivas. Tu tarifa de reserva bajó de ' || _old_fee || '% a ' || _new_fee || '%.'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Update provider milestone notification to include bilingual text
CREATE OR REPLACE FUNCTION public.notify_provider_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _provider_user_id UUID;
  _old_rate numeric(5,2);
  _new_rate numeric(5,2);
BEGIN
  IF NEW.completed_bookings >= 10
    AND (OLD.completed_bookings IS NULL OR FLOOR(NEW.completed_bookings / 10.0) > FLOOR(OLD.completed_bookings / 10.0))
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
$$;