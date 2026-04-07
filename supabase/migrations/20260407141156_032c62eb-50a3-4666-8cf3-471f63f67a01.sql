-- Create boleto_settings table
CREATE TABLE public.boleto_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  default_expiration_days integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.boleto_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.boleto_settings FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.boleto_settings FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.boleto_settings FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.boleto_settings FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

CREATE TRIGGER update_boleto_settings_updated_at
  BEFORE UPDATE ON public.boleto_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create boleto_recovery_rules table
CREATE TABLE public.boleto_recovery_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  rule_type text NOT NULL DEFAULT 'days_after_generation',
  days integer NOT NULL DEFAULT 1,
  message text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  media_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.boleto_recovery_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.boleto_recovery_rules FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.boleto_recovery_rules FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.boleto_recovery_rules FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.boleto_recovery_rules FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

CREATE TRIGGER update_boleto_recovery_rules_updated_at
  BEFORE UPDATE ON public.boleto_recovery_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create boleto_recovery_contacts table
CREATE TABLE public.boleto_recovery_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  rule_id uuid REFERENCES public.boleto_recovery_rules(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.boleto_recovery_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.boleto_recovery_contacts FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.boleto_recovery_contacts FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.boleto_recovery_contacts FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.boleto_recovery_contacts FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));