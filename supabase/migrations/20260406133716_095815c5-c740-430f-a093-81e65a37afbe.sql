CREATE TABLE public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.email_campaigns(id),
  template_id uuid REFERENCES public.email_templates(id),
  smtp_config_id uuid,
  recipient_email text NOT NULL,
  recipient_name text,
  personalization jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email queue" ON public.email_queue
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_email_queue_pending ON public.email_queue(status, created_at) WHERE status = 'pending';