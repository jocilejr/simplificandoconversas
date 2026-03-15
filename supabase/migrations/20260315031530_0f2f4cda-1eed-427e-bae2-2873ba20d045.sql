
CREATE TABLE public.meta_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Meu Pixel',
  pixel_id text NOT NULL,
  access_token text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_pixels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pixels"
  ON public.meta_pixels
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
