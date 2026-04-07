
CREATE TABLE public.boleto_recovery_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Template Padrão',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.boleto_recovery_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view templates"
  ON public.boleto_recovery_templates FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Writers can insert templates"
  ON public.boleto_recovery_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "Writers can update templates"
  ON public.boleto_recovery_templates FOR UPDATE
  TO authenticated
  USING (public.can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "Writers can delete templates"
  ON public.boleto_recovery_templates FOR DELETE
  TO authenticated
  USING (public.can_write_workspace(auth.uid(), workspace_id));
