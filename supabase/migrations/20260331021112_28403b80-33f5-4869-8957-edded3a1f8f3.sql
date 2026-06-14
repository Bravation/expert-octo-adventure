-- Create notification function for provider milestones
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
      jsonb_build_object('completed_bookings', NEW.completed_bookings, 'old_rate', _old_rate, 'new_rate', _new_rate)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to provider_milestones table
CREATE TRIGGER on_provider_milestone_update
  AFTER UPDATE ON public.provider_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_provider_milestone();