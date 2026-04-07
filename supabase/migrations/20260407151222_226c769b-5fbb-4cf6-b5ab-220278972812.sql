
CREATE TABLE public.message_queue_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  delay_seconds integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, instance_name)
);

ALTER TABLE public.message_queue_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.message_queue_config FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.message_queue_config FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.message_queue_config FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.message_queue_config FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

CREATE TRIGGER update_message_queue_config_updated_at BEFORE UPDATE ON public.message_queue_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.followup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  instance_name text,
  send_after_minutes integer NOT NULL DEFAULT 5,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.followup_settings FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.followup_settings FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.followup_settings FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.followup_settings FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

CREATE TRIGGER update_followup_settings_updated_at BEFORE UPDATE ON public.followup_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
