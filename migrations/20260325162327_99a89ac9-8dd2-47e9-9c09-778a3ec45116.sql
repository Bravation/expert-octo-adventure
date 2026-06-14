
CREATE OR REPLACE FUNCTION public.notify_customer_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _customer_user_id UUID;
  _old_fee numeric(5,2);
  _new_fee numeric(5,2);
BEGIN
  -- Only fire when positive_reviews crosses a new 10-milestone
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
      jsonb_build_object('positive_reviews', NEW.positive_reviews, 'old_fee', _old_fee, 'new_fee', _new_fee)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_customer_milestone_reached
  AFTER UPDATE ON public.customer_milestones
  FOR EACH ROW EXECUTE FUNCTION public.notify_customer_milestone();
