
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send push notification via edge function on new message
CREATE OR REPLACE FUNCTION public.push_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _recipient_user_id UUID;
  _sender_name TEXT;
  _conv RECORD;
  _supabase_url TEXT;
  _service_role_key TEXT;
BEGIN
  -- Get conversation details
  SELECT * INTO _conv FROM conversations WHERE id = NEW.conversation_id;
  
  -- Determine recipient (the other party)
  IF NEW.sender_id = _conv.customer_id THEN
    SELECT user_id INTO _recipient_user_id FROM profiles WHERE id = _conv.provider_id;
  ELSE
    SELECT user_id INTO _recipient_user_id FROM profiles WHERE id = _conv.customer_id;
  END IF;
  
  SELECT full_name INTO _sender_name FROM profiles WHERE id = NEW.sender_id;

  -- Get secrets from vault or use env
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings not available, try to get from environment
  IF _supabase_url IS NULL THEN
    _supabase_url := 'https://amxokitgzvmxbijijzjd.supabase.co';
  END IF;

  -- Call edge function via pg_net
  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/send-push',
    body := jsonb_build_object(
      'user_id', _recipient_user_id,
      'title', 'New Message from ' || COALESCE(_sender_name, 'Someone'),
      'body', LEFT(NEW.content, 100),
      'data', jsonb_build_object('url', '/dashboard', 'type', 'new_message')
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_role_key
    )::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the insert if push notification fails
  RETURN NEW;
END;
$$;

-- Function to send push notification on booking status change
CREATE OR REPLACE FUNCTION public.push_on_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_user_id UUID;
  _service_title TEXT;
  _status_text TEXT;
  _supabase_url TEXT;
BEGIN
  -- Only push on meaningful status changes
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  
  SELECT title INTO _service_title FROM services WHERE id = NEW.service_id;
  _status_text := REPLACE(NEW.status::text, '_', ' ');

  -- Notify customer about provider actions
  IF NEW.status IN ('confirmed', 'in_progress', 'completed', 'cancelled') THEN
    SELECT user_id INTO _target_user_id FROM profiles WHERE id = NEW.customer_id;
  END IF;

  IF _target_user_id IS NULL THEN RETURN NEW; END IF;

  _supabase_url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://amxokitgzvmxbijijzjd.supabase.co'
  );

  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/send-push',
    body := jsonb_build_object(
      'user_id', _target_user_id,
      'title', 'Booking ' || INITCAP(_status_text),
      'body', 'Your booking for "' || COALESCE(_service_title, 'a service') || '" is now ' || _status_text,
      'data', jsonb_build_object('url', '/dashboard', 'type', 'booking_update', 'booking_id', NEW.id)
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    )::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER push_new_message_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION push_on_new_message();

CREATE TRIGGER push_booking_update_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION push_on_booking_update();
