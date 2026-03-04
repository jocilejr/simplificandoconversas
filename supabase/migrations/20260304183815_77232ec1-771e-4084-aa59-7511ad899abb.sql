
-- Drop the restrictive policy
DROP POLICY "Users manage own contact photos" ON public.contact_photos;

-- Create a permissive policy instead
CREATE POLICY "Users manage own contact photos" ON public.contact_photos
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
