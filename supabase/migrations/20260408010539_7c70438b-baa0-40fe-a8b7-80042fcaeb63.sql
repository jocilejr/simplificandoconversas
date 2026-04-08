
-- 1. Adicionar coluna que falta
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_message_abandoned text DEFAULT NULL;

-- 2. Backfill mensagens padrão
UPDATE profiles 
SET recovery_message_pix = E'{saudação}, {primeiro_nome}! 😊\n\nNotei que seu pagamento de {valor} via PIX/Cartão está pendente. Precisa de ajuda para finalizar?\n\nSe já realizou o pagamento, por favor desconsidere! 🙏'
WHERE recovery_message_pix IS NULL;

UPDATE profiles 
SET recovery_message_abandoned = E'{saudação}, {primeiro_nome}! 😊\n\nVi que você teve um problema com seu pagamento de {valor}. Posso te ajudar a finalizar?\n\nSe já resolveu, pode desconsiderar! 🙏'
WHERE recovery_message_abandoned IS NULL;

UPDATE profiles 
SET recovery_message_boleto = E'{saudação}, {primeiro_nome}! 😊\n\nVi que seu boleto no valor de {valor} ainda está em aberto. Posso te ajudar com algo?\n\nCaso já tenha pago, pode desconsiderar essa mensagem! 🙏'
WHERE recovery_message_boleto IS NULL;

-- 3. Atualizar handle_new_user para incluir mensagens padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _ws_id uuid;
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    full_name,
    recovery_message_boleto,
    recovery_message_pix,
    recovery_message_abandoned
  )
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'full_name',
    E'{saudação}, {primeiro_nome}! 😊\n\nVi que seu boleto no valor de {valor} ainda está em aberto. Posso te ajudar com algo?\n\nCaso já tenha pago, pode desconsiderar essa mensagem! 🙏',
    E'{saudação}, {primeiro_nome}! 😊\n\nNotei que seu pagamento de {valor} via PIX/Cartão está pendente. Precisa de ajuda para finalizar?\n\nSe já realizou o pagamento, por favor desconsidere! 🙏',
    E'{saudação}, {primeiro_nome}! 😊\n\nVi que você teve um problema com seu pagamento de {valor}. Posso te ajudar a finalizar?\n\nSe já resolveu, pode desconsiderar! 🙏'
  )
  ON CONFLICT DO NOTHING;

  _ws_id := gen_random_uuid();
  INSERT INTO public.workspaces (id, name, slug, created_by)
  VALUES (_ws_id, 'Meu Workspace', 'ws-' || substr(replace(_ws_id::text, '-', ''), 1, 12), NEW.id);

  RETURN NEW;
END;
$function$;
