-- recovery_settings (1 per workspace)
CREATE TABLE IF NOT EXISTS public.recovery_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  instance_name text,
  delay_seconds integer NOT NULL DEFAULT 20,
  send_after_minutes integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.recovery_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.recovery_settings TO anon, authenticated, service_role;

CREATE POLICY "ws_select" ON public.recovery_settings FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.recovery_settings FOR INSERT TO authenticated
  WITH CHECK (public.can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.recovery_settings FOR UPDATE TO authenticated
  USING (public.can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.recovery_settings FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

CREATE TRIGGER update_recovery_settings_updated_at
  BEFORE UPDATE ON public.recovery_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- recovery_queue
CREATE TABLE IF NOT EXISTS public.recovery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  customer_phone text NOT NULL,
  customer_name text,
  amount numeric NOT NULL DEFAULT 0,
  transaction_type text NOT NULL DEFAULT 'pix',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_queue ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.recovery_queue TO anon, authenticated, service_role;

CREATE POLICY "ws_select" ON public.recovery_queue FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.recovery_queue FOR INSERT TO authenticated
  WITH CHECK (public.can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.recovery_queue FOR UPDATE TO authenticated
  USING (public.can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.recovery_queue FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

CREATE INDEX idx_recovery_queue_workspace ON public.recovery_queue(workspace_id);
CREATE INDEX idx_recovery_queue_status ON public.recovery_queue(status, scheduled_at);
CREATE INDEX idx_recovery_queue_transaction ON public.recovery_queue(transaction_id);