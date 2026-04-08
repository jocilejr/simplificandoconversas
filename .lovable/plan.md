

# Corrigir recuperação: coluna inexistente + mensagem não persistida

## Problemas confirmados na VPS

1. **`recovery_message_abandoned` NÃO EXISTE** na tabela `profiles` do VPS — a migração do Lovable Cloud não foi aplicada lá
2. **`recovery_message_pix` está NULL** no banco — o modal exibe um texto padrão visual (`DEFAULT_PIX_MSG`) mas nunca o salvou no banco
3. O backend busca `recovery_message_pix` no banco, encontra NULL, e marca como `failed`

**Causa raiz**: O modal mostra uma mensagem "fake" via fallback visual (`|| defaultMsg`) mas só persiste quando o usuário clica "Salvar". Como nunca foi salvo, o banco está vazio.

## Solução

### 1. Migração SQL — adicionar coluna + backfill

```sql
-- Adicionar coluna que falta
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_message_abandoned text DEFAULT NULL;

-- Backfill: preencher campos NULL com as mensagens padrão
UPDATE profiles 
SET recovery_message_pix = '{saudação}, {primeiro_nome}! 😊

Notei que seu pagamento de {valor} via PIX/Cartão está pendente. Precisa de ajuda para finalizar?

Se já realizou o pagamento, por favor desconsidere! 🙏'
WHERE recovery_message_pix IS NULL;

UPDATE profiles 
SET recovery_message_abandoned = '{saudação}, {primeiro_nome}! 😊

Vi que você teve um problema com seu pagamento de {valor}. Posso te ajudar a finalizar?

Se já resolveu, pode desconsiderar! 🙏'
WHERE recovery_message_abandoned IS NULL;

UPDATE profiles 
SET recovery_message_boleto = '{saudação}, {primeiro_nome}! 😊

Vi que seu boleto no valor de {valor} ainda está em aberto. Posso te ajudar com algo?

Caso já tenha pago, pode desconsiderar essa mensagem! 🙏'
WHERE recovery_message_boleto IS NULL;
```

### 2. Trigger `handle_new_user` — novos usuários já nascem com mensagens

Atualizar a função para inserir os 3 campos com valores padrão no `INSERT INTO profiles`.

### 3. Frontend `RecoverySettingsDialog.tsx` — sem mudança

O modal já funciona corretamente: mostra o fallback se NULL e salva quando o usuário clica "Salvar". Após o backfill, o banco terá valores reais e o fallback nunca será acionado.

### 4. Backend `recovery-dispatch.ts` — sem mudança

Já está correto: lê do banco sem fallback. Após o backfill, encontrará a mensagem.

## Verificação na VPS após deploy

```bash
cd ~/simplificandoconversas/deploy

# 1. Aplicar migração manualmente (a do Lovable Cloud não roda na VPS)
docker compose exec -T postgres psql -U postgres -d postgres -c "
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_message_abandoned text DEFAULT NULL;
"

# 2. Backfill
docker compose exec -T postgres psql -U postgres -d postgres -c "
UPDATE profiles SET recovery_message_pix = E'{saudação}, {primeiro_nome}! 😊\n\nNotei que seu pagamento de {valor} via PIX/Cartão está pendente. Precisa de ajuda para finalizar?\n\nSe já realizou o pagamento, por favor desconsidere! 🙏' WHERE recovery_message_pix IS NULL;
UPDATE profiles SET recovery_message_abandoned = E'{saudação}, {primeiro_nome}! 😊\n\nVi que você teve um problema com seu pagamento de {valor}. Posso te ajudar a finalizar?\n\nSe já resolveu, pode desconsiderar! 🙏' WHERE recovery_message_abandoned IS NULL;
UPDATE profiles SET recovery_message_boleto = E'{saudação}, {primeiro_nome}! 😊\n\nVi que seu boleto no valor de {valor} ainda está em aberto. Posso te ajudar com algo?\n\nCaso já tenha pago, pode desconsiderar essa mensagem! 🙏' WHERE recovery_message_boleto IS NULL;
"

# 3. Notificar PostgREST do novo schema
docker compose exec -T postgres psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
docker compose restart postgrest

# 4. Rebuild backend
docker compose up -d --build backend

# 5. Verificar
docker compose exec -T postgres psql -U postgres -d postgres -c "SELECT user_id, length(recovery_message_pix) as pix_len, length(recovery_message_abandoned) as abandoned_len, length(recovery_message_boleto) as boleto_len FROM profiles;"
```

## Arquivos alterados
1. **Migração SQL** — adicionar `recovery_message_abandoned` + backfill dos 3 campos
2. **Função `handle_new_user`** — incluir mensagens padrão na criação de perfil

## Resultado
- Todas as mensagens já estarão salvas no banco
- O backend encontrará a mensagem e enviará corretamente
- O modal continuará funcionando como antes, mas agora refletindo dados reais

