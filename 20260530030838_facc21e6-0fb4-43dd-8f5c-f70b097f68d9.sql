ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS estimated_hours numeric(5,2);