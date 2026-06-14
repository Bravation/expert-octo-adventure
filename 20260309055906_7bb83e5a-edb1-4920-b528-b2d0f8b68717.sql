
-- Update default booking fee percentage to 10%
ALTER TABLE public.bookings ALTER COLUMN booking_fee_percentage SET DEFAULT 10.00;
