
CREATE OR REPLACE FUNCTION public.notify_customer_quote_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _customer_user_id UUID;
  _provider_name TEXT;
  _service_title TEXT;
  _title_en TEXT;
  _title_es TEXT;
  _msg_en TEXT;
  _msg_es TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('accepted', 'declined') THEN RETURN NEW; END IF;

  SELECT user_id INTO _customer_user_id FROM profiles WHERE id = NEW.customer_id;
  SELECT full_name INTO _provider_name FROM profiles WHERE id = NEW.provider_id;
  SELECT title INTO _service_title FROM services WHERE id = NEW.service_id;

  IF NEW.status = 'accepted' THEN
    _title_en := 'Request Accepted ✅';
    _title_es := 'Solicitud Aceptada ✅';
    _msg_en := COALESCE(_provider_name, 'The provider') || ' accepted your request for "' || COALESCE(_service_title, 'a service') || '"';
    _msg_es := COALESCE(_provider_name, 'El proveedor') || ' aceptó tu solicitud para "' || COALESCE(_service_title, 'un servicio') || '"';
  ELSE
    _title_en := 'Request Declined';
    _title_es := 'Solicitud Rechazada';
    _msg_en := COALESCE(_provider_name, 'The provider') || ' declined your request for "' || COALESCE(_service_title, 'a service') || '"';
    _msg_es := COALESCE(_provider_name, 'El proveedor') || ' rechazó tu solicitud para "' || COALESCE(_service_title, 'un servicio') || '"';
  END IF;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    _customer_user_id,
    'booking_update',
    _title_en,
    _msg_en,
    jsonb_build_object(
      'quote_id', NEW.id,
      'service_id', NEW.service_id,
      'provider_id', NEW.provider_id,
      'status', NEW.status,
      'title_es', _title_es,
      'message_es', _msg_es
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_customer_quote_status ON public.custom_quotes;
CREATE TRIGGER trg_notify_customer_quote_status
AFTER UPDATE ON public.custom_quotes
FOR EACH ROW
EXECUTE FUNCTION public.notify_customer_quote_status();
