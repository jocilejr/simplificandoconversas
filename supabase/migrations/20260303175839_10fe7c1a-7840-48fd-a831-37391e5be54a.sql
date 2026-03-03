
-- Create storage bucket for chatbot media
INSERT INTO storage.buckets (id, name, public) VALUES ('chatbot-media', 'chatbot-media', true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload chatbot media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chatbot-media');

-- Allow public read access
CREATE POLICY "Public can view chatbot media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chatbot-media');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own chatbot media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chatbot-media');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own chatbot media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chatbot-media');
