
ALTER TABLE public.custom_quotes
ADD COLUMN IF NOT EXISTS attachment_urls text[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-attachments', 'quote-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view quote attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'quote-attachments');

CREATE POLICY "Users can upload own quote attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quote-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own quote attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'quote-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own quote attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'quote-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
