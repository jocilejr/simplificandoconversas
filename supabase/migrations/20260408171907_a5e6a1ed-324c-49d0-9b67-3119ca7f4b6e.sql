
CREATE TABLE public.financial_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  
  boleto_fee_type text NOT NULL DEFAULT 'fixed',
  boleto_fee_value numeric NOT NULL DEFAULT 0,
  pix_fee_type text NOT NULL DEFAULT 'fixed',
  pix_fee_value numeric NOT NULL DEFAULT 0,
  cartao_fee_type text NOT NULL DEFAULT 'percent',
  cartao_fee_value numeric NOT NULL DEFAULT 0,
  
  tax_type text NOT NULL DEFAULT 'percent',
  tax_value numeric NOT NULL DEFAULT 0,
  tax_name text NOT NULL DEFAULT 'Imposto',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(workspace_id)
);

ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.financial_settings FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.financial_settings FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.financial_settings FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.financial_settings FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

CREATE TRIGGER update_financial_settings_updated_at
  BEFORE UPDATE ON public.financial_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
