
-- Create storage bucket for service photos
INSERT INTO storage.buckets (id, name, public) VALUES ('service-photos', 'service-photos', true);

-- Allow authenticated users to upload service photos
CREATE POLICY "Authenticated users can upload service photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'service-photos');

-- Allow anyone to view service photos
CREATE POLICY "Anyone can view service photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-photos');

-- Allow users to update their own service photos
CREATE POLICY "Users can update own service photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'service-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own service photos
CREATE POLICY "Users can delete own service photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'service-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
