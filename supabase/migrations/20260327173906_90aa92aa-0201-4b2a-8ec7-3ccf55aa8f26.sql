UPDATE public.customer_milestones 
SET positive_reviews = 75, 
    current_booking_fee_percentage = GREATEST(3.00, 10.00 - FLOOR(75 / 10.0)),
    updated_at = now()
WHERE customer_id = 'e016e3e1-20d4-47ec-b58a-169f3c910881';