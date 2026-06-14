
-- Customer milestones table
CREATE TABLE public.customer_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE,
  positive_reviews integer NOT NULL DEFAULT 0,
  current_booking_fee_percentage numeric(5,2) NOT NULL DEFAULT 10.00,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_milestones ENABLE ROW LEVEL SECURITY;

-- RLS: customers can view own milestones
CREATE POLICY "Customers can view own milestones"
  ON public.customer_milestones
  FOR SELECT TO authenticated
  USING (customer_id = get_profile_id(auth.uid()));

-- Auto-create customer milestone on profile creation for customers
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.role = 'customer' THEN
    INSERT INTO public.customer_milestones (customer_id) VALUES (NEW.id)
    ON CONFLICT (customer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_customer_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- Update customer milestones when a positive review is submitted
CREATE OR REPLACE FUNCTION public.update_customer_milestone_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _positive_count integer;
  _new_fee numeric(5,2);
BEGIN
  -- Only count positive reviews (4 or 5 stars)
  IF NEW.rating >= 4 THEN
    -- Ensure milestone row exists
    INSERT INTO public.customer_milestones (customer_id)
    VALUES (NEW.reviewer_id)
    ON CONFLICT (customer_id) DO NOTHING;

    -- Count all positive reviews by this customer
    SELECT COUNT(*) INTO _positive_count
    FROM public.reviews
    WHERE reviewer_id = NEW.reviewer_id AND rating >= 4;

    -- Calculate fee: start at 10%, reduce by 1% every 10 positive reviews, minimum 2%
    _new_fee := GREATEST(2.00, 10.00 - FLOOR(_positive_count / 10.0));

    UPDATE public.customer_milestones
    SET positive_reviews = _positive_count,
        current_booking_fee_percentage = _new_fee,
        updated_at = now()
    WHERE customer_id = NEW.reviewer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_review_update_customer_milestone
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_milestone_on_review();
