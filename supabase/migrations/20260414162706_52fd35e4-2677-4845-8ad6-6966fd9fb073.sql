CREATE TABLE public.meta_ad_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  campaign_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, date, campaign_name)
);

ALTER TABLE public.meta_ad_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.meta_ad_spend FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ws_insert" ON public.meta_ad_spend FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "ws_update" ON public.meta_ad_spend FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "ws_delete" ON public.meta_ad_spend FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));