CREATE TABLE public.email_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES public.email_sends(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  original_url text NOT NULL,
  clicked boolean DEFAULT false,
  clicked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_link_clicks_send_id ON public.email_link_clicks(send_id);
CREATE INDEX idx_email_link_clicks_user_id ON public.email_link_clicks(user_id);

ALTER TABLE public.email_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own link clicks"
  ON public.email_link_clicks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());