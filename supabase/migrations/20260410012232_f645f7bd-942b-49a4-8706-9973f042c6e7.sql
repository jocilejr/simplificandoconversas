
CREATE TABLE public.workspace_domains (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  domain text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_domain UNIQUE (workspace_id, domain)
);

ALTER TABLE public.workspace_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.workspace_domains FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ws_insert" ON public.workspace_domains FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "ws_update" ON public.workspace_domains FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "ws_delete" ON public.workspace_domains FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
