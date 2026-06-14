
CREATE TABLE public.quote_edit_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  edited_by_profile_id uuid,
  edited_by_user_id uuid,
  editor_role text,
  old_price numeric,
  new_price numeric,
  old_description text,
  new_description text,
  old_status text,
  new_status text,
  admin_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_edit_audit_log_quote_id ON public.quote_edit_audit_log(quote_id);
CREATE INDEX idx_quote_edit_audit_log_created_at ON public.quote_edit_audit_log(created_at DESC);

GRANT SELECT ON public.quote_edit_audit_log TO authenticated;
GRANT ALL ON public.quote_edit_audit_log TO service_role;

ALTER TABLE public.quote_edit_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view quote audit log"
ON public.quote_edit_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.custom_quotes q
    WHERE q.id = quote_edit_audit_log.quote_id
      AND (q.customer_id = public.get_profile_id(auth.uid())
        OR q.provider_id = public.get_profile_id(auth.uid()))
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE OR REPLACE FUNCTION public.log_custom_quote_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _editor_profile_id uuid;
  _editor_role text;
  _is_admin boolean := false;
  _override boolean := false;
  _min_price numeric := 20;
  _max_price numeric := 200000;
BEGIN
  -- Skip if nothing relevant changed
  IF NEW.custom_price IS NOT DISTINCT FROM OLD.custom_price
    AND NEW.description IS NOT DISTINCT FROM OLD.description
    AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  BEGIN
    _is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  EXCEPTION WHEN OTHERS THEN
    _is_admin := false;
  END;

  _editor_profile_id := public.get_profile_id(auth.uid());
  _editor_role := COALESCE(public.get_user_role(auth.uid())::text, 'unknown');
  IF _is_admin THEN _editor_role := 'admin'; END IF;

  -- Admin override considered "used" when price falls outside the standard $20-$200,000 range
  IF _is_admin AND NEW.custom_price IS DISTINCT FROM OLD.custom_price
     AND (NEW.custom_price < _min_price OR NEW.custom_price > _max_price) THEN
    _override := true;
  END IF;

  INSERT INTO public.quote_edit_audit_log (
    quote_id, edited_by_profile_id, edited_by_user_id, editor_role,
    old_price, new_price, old_description, new_description,
    old_status, new_status, admin_override
  ) VALUES (
    NEW.id, _editor_profile_id, auth.uid(), _editor_role,
    OLD.custom_price, NEW.custom_price,
    OLD.description, NEW.description,
    OLD.status, NEW.status,
    _override
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_log_custom_quote_edit
AFTER UPDATE ON public.custom_quotes
FOR EACH ROW
EXECUTE FUNCTION public.log_custom_quote_edit();
