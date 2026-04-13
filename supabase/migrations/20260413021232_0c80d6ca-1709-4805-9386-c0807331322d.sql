
-- Smart Links table
CREATE TABLE public.group_smart_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.group_campaigns(id) ON DELETE CASCADE,
  slug text NOT NULL,
  max_members_per_group int NOT NULL DEFAULT 200,
  group_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_group_index int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

ALTER TABLE public.group_smart_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.group_smart_links FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ws_insert" ON public.group_smart_links FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "ws_update" ON public.group_smart_links FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "ws_delete" ON public.group_smart_links FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

CREATE TRIGGER update_group_smart_links_updated_at
  BEFORE UPDATE ON public.group_smart_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Smart Link Clicks table
CREATE TABLE public.group_smart_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_link_id uuid NOT NULL REFERENCES public.group_smart_links(id) ON DELETE CASCADE,
  group_jid text NOT NULL,
  redirected_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_smart_link_clicks ENABLE ROW LEVEL SECURITY;

-- Clicks are read via backend (service_role), but allow anon insert from redirect route
CREATE POLICY "service_select" ON public.group_smart_link_clicks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_smart_links sl
    WHERE sl.id = smart_link_id AND is_workspace_member(auth.uid(), sl.workspace_id)
  ));
