-- Reset test data: restore milestone to original state
UPDATE public.customer_milestones
SET positive_reviews = 0,
    current_booking_fee_percentage = 10.00,
    updated_at = now()
WHERE customer_id = 'e016e3e1-20d4-47ec-b58a-169f3c910881';

-- Clean up test notifications
DELETE FROM public.notifications
WHERE user_id = 'c6227ba4-4028-456e-acbe-91f4c8937b6c' AND type = 'milestone';