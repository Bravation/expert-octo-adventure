
CREATE OR REPLACE FUNCTION public.validate_custom_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _desc_len integer;
BEGIN
  -- Price validation
  IF NEW.custom_price IS NULL OR NEW.custom_price <= 0 THEN
    RAISE EXCEPTION 'price: Price must be greater than 0'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.custom_price > 1000000 THEN
    RAISE EXCEPTION 'price: Price must be $1,000,000 or less'
      USING ERRCODE = 'check_violation';
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
$$;

DROP TRIGGER IF EXISTS validate_custom_quote_trigger ON public.custom_quotes;
CREATE TRIGGER validate_custom_quote_trigger
BEFORE INSERT OR UPDATE ON public.custom_quotes
FOR EACH ROW
EXECUTE FUNCTION public.validate_custom_quote();
