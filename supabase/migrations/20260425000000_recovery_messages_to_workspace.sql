-- Move recovery message templates from profiles (per-user) to recovery_settings (per-workspace)
-- This ensures operators in the same workspace use the same message template

ALTER TABLE public.recovery_settings
  ADD COLUMN IF NOT EXISTS recovery_message_pix text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recovery_message_abandoned text DEFAULT NULL;

-- Migrate existing messages from workspace owners' profiles to recovery_settings
UPDATE public.recovery_settings rs
SET
  recovery_message_pix = COALESCE(p.recovery_message_pix, E'{saudação}, {primeiro_nome}! 😊\n\nNotei que seu pagamento de {valor} via PIX/Cartão está pendente. Precisa de ajuda para finalizar?\n\nSe já realizou o pagamento, por favor desconsidere! 🙏'),
  recovery_message_abandoned = COALESCE(p.recovery_message_abandoned, E'{saudação}, {primeiro_nome}! 😊\n\nVi que você teve um problema com seu pagamento de {valor}. Posso te ajudar a finalizar?\n\nSe já resolveu, pode desconsiderar! 🙏')
FROM public.workspaces w
JOIN public.profiles p ON p.user_id = w.created_by
WHERE rs.workspace_id = w.id
  AND rs.recovery_message_pix IS NULL;
