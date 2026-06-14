
-- Add photo_urls array column to services
ALTER TABLE public.services ADD COLUMN photo_urls TEXT[] DEFAULT '{}';

-- Migrate existing photo_url data into photo_urls array
UPDATE public.services SET photo_urls = ARRAY[photo_url] WHERE photo_url IS NOT NULL AND photo_url != '';
