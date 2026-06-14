
CREATE OR REPLACE FUNCTION public.notify_customer_booking_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _customer_user_id UUID;
  _service_title TEXT;
  _status_text TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('confirmed', 'in_progress', 'completed', 'cancelled') THEN RETURN NEW; END IF;

  SELECT user_id INTO _customer_user_id FROM profiles WHERE id = NEW.customer_id;
  SELECT title INTO _service_title FROM services WHERE id = NEW.service_id;

  _status_text := REPLACE(NEW.status::text, '_', ' ');

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    _customer_user_id,
    'booking_update',
    'Booking ' || INITCAP(_status_text),
    'Your booking for "' || COALESCE(_service_title, 'a service') || '" is now ' || _status_text,
    jsonb_build_object('booking_id', NEW.id, 'status', NEW.status::text, 'service_id', NEW.service_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_status_notify
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_booking_status();
