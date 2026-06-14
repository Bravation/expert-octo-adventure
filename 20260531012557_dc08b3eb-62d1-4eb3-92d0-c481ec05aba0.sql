CREATE OR REPLACE FUNCTION public.validate_custom_quote()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _desc_len integer;
  _is_admin boolean := false;
  _min_price numeric := 20;
  _max_price numeric := 200000;
BEGIN
  -- Admin override: allow any positive price up to 1,000,000
  BEGIN
    _is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  EXCEPTION WHEN OTHERS THEN
    _is_admin := false;
  END;

  -- Price validation
  IF NEW.custom_price IS NULL THEN
    RAISE EXCEPTION 'price: Price is required'
      USING ERRCODE = 'check_violation';
  END IF;

  IF _is_admin THEN
    IF NEW.custom_price <= 0 OR NEW.custom_price > 1000000 THEN
      RAISE EXCEPTION 'price: Admin price must be between $0.01 and $1,000,000'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.custom_price < _min_price THEN
      RAISE EXCEPTION 'price: Quote price must be at least $20'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.custom_price > _max_price THEN
      RAISE EXCEPTION 'price: Quote price cannot exceed $200,000'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Description validation
  _desc_len := char_length(COALESCE(btrim(NEW.description), ''));
  IF _desc_len < 10 THEN
    RAISE EXCEPTION 'description: Description must be at least 10 characters'
      USING ERRCODE = 'check_violation';
  END IF;
  IF _desc_len > 1000 THEN
    RAISE EXCEPTION 'description: Description must be 1000 characters or less'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;