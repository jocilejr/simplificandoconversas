
-- 1. email_follow_ups
CREATE TABLE public.email_follow_ups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  delay_days integer NOT NULL DEFAULT 1,
  step_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own follow ups" ON public.email_follow_ups FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2. email_follow_up_sends
CREATE TABLE public.email_follow_up_sends (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follow_up_id uuid NOT NULL REFERENCES public.email_follow_ups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_follow_up_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own follow up sends" ON public.email_follow_up_sends FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. email_events
CREATE TABLE public.email_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  send_id uuid REFERENCES public.email_sends(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own email events" ON public.email_events FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_email_events_send_id ON public.email_events(send_id);
CREATE INDEX idx_email_events_type ON public.email_events(event_type);

-- 4. email_suppressions
CREATE TABLE public.email_suppressions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'bounce',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own suppressions" ON public.email_suppressions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. Alter smtp_config: add label
ALTER TABLE public.smtp_config ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Principal';

-- 6. Alter email_campaigns: add smtp_config_id, opened_count
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS smtp_config_id uuid REFERENCES public.smtp_config(id) ON DELETE SET NULL;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS opened_count integer NOT NULL DEFAULT 0;

-- 7. Alter email_sends: add opened_at
ALTER TABLE public.email_sends ADD COLUMN IF NOT EXISTS opened_at timestamptz;

-- Indexes
CREATE INDEX idx_follow_up_sends_scheduled ON public.email_follow_up_sends(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_suppressions_email ON public.email_suppressions(user_id, email);
