CREATE TABLE public.contact_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  remote_jid text NOT NULL,
  photo_url text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, remote_jid)
);

ALTER TABLE public.contact_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contact photos" ON public.contact_photos
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);