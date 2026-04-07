
-- Add recovery message fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recovery_message_boleto text,
  ADD COLUMN IF NOT EXISTS recovery_message_pix text;

-- Create recovery_clicks table
CREATE TABLE public.recovery_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL,
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  recovery_type text NOT NULL DEFAULT 'boleto',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recovery_clicks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "ws_select" ON public.recovery_clicks
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ws_insert" ON public.recovery_clicks
  FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "ws_delete" ON public.recovery_clicks
  FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- Index for fast lookups by transaction
CREATE INDEX idx_recovery_clicks_transaction ON public.recovery_clicks(transaction_id);
CREATE INDEX idx_recovery_clicks_workspace ON public.recovery_clicks(workspace_id);
