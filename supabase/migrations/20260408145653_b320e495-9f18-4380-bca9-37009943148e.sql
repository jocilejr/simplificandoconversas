
CREATE TABLE public.group_queue_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  max_messages_per_group integer NOT NULL DEFAULT 3,
  per_minutes integer NOT NULL DEFAULT 60,
  delay_between_sends_ms integer NOT NULL DEFAULT 3000,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.group_queue_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.group_queue_config FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.group_queue_config FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.group_queue_config FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.group_queue_config FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

CREATE TRIGGER update_group_queue_config_updated_at
  BEFORE UPDATE ON public.group_queue_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
