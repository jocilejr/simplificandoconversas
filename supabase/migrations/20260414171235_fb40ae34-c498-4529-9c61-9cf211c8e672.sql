
-- Table for multiple Meta Ads accounts per workspace
CREATE TABLE public.meta_ad_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Conta Principal',
  access_token TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.meta_ad_accounts FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ws_insert" ON public.meta_ad_accounts FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "ws_update" ON public.meta_ad_accounts FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "ws_delete" ON public.meta_ad_accounts FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- Add account reference to meta_ad_spend
ALTER TABLE public.meta_ad_spend
  ADD COLUMN account_id UUID REFERENCES public.meta_ad_accounts(id) ON DELETE SET NULL;
