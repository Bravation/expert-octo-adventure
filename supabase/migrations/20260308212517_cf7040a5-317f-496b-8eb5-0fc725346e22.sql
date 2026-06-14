
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _conv RECORD;
  _recipient_id UUID;
  _recipient_user_id UUID;
  _sender_name TEXT;
BEGIN
  SELECT * INTO _conv FROM conversations WHERE id = NEW.conversation_id;

  -- Determine recipient (the other party)
  IF NEW.sender_id = _conv.customer_id THEN
    _recipient_id := _conv.provider_id;
  ELSE
    _recipient_id := _conv.customer_id;
  END IF;

  SELECT user_id INTO _recipient_user_id FROM profiles WHERE id = _recipient_id;
  SELECT full_name INTO _sender_name FROM profiles WHERE id = NEW.sender_id;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    _recipient_user_id,
    'new_message',
    'New Message from ' || COALESCE(_sender_name, 'Someone'),
    LEFT(NEW.content, 150),
    jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_message();
