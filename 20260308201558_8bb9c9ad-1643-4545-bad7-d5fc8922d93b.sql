
-- Auto-create conversation when a booking is created
CREATE OR REPLACE FUNCTION public.create_conversation_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.conversations (booking_id, customer_id, provider_id)
  VALUES (NEW.id, NEW.customer_id, NEW.provider_id)
  ON CONFLICT (booking_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_booking_create_conversation
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.create_conversation_on_booking();
