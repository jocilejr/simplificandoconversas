
-- group_selected
CREATE TABLE IF NOT EXISTS public.group_selected (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  instance_name text NOT NULL,
  group_jid text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, group_jid)
);
ALTER TABLE public.group_selected ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.group_selected FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.group_selected FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.group_selected FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.group_selected FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- group_campaigns
CREATE TABLE IF NOT EXISTS public.group_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  instance_name text NOT NULL,
  group_jids text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.group_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.group_campaigns FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.group_campaigns FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.group_campaigns FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.group_campaigns FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
CREATE TRIGGER update_group_campaigns_updated_at BEFORE UPDATE ON public.group_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- group_scheduled_messages
CREATE TABLE IF NOT EXISTS public.group_scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.group_campaigns(id) ON DELETE CASCADE,
  message_type text NOT NULL DEFAULT 'text',
  content jsonb NOT NULL DEFAULT '{}',
  schedule_type text NOT NULL DEFAULT 'once',
  cron_expression text,
  interval_minutes integer,
  scheduled_at timestamptz,
  next_run_at timestamptz,
  last_run_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.group_scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.group_scheduled_messages FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.group_scheduled_messages FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.group_scheduled_messages FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.group_scheduled_messages FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
CREATE TRIGGER update_group_scheduled_messages_updated_at BEFORE UPDATE ON public.group_scheduled_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- group_message_queue
CREATE TABLE IF NOT EXISTS public.group_message_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.group_campaigns(id) ON DELETE SET NULL,
  scheduled_message_id uuid REFERENCES public.group_scheduled_messages(id) ON DELETE SET NULL,
  group_jid text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  instance_name text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  content jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  priority integer NOT NULL DEFAULT 0,
  execution_batch text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
ALTER TABLE public.group_message_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.group_message_queue FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.group_message_queue FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.group_message_queue FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.group_message_queue FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
CREATE INDEX idx_group_message_queue_status ON public.group_message_queue(status);
CREATE INDEX idx_group_message_queue_workspace ON public.group_message_queue(workspace_id, status);

-- group_participant_events
CREATE TABLE IF NOT EXISTS public.group_participant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  instance_name text NOT NULL,
  group_jid text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  participant_jid text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.group_participant_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.group_participant_events FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.group_participant_events FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE INDEX idx_group_participant_events_workspace ON public.group_participant_events(workspace_id, created_at DESC);
