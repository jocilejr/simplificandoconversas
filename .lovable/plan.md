

# Permitir reenvio automático a cada evento de webhook

## Problema
A lógica de auto-send no `register_email` verifica se já existe um `email_sends` para aquela campanha+email e **pula o envio** se encontrar. Isso impede que o e-mail seja reenviado quando o mesmo contato recebe novamente a tag via webhook.

## Solução
Remover a verificação de envio duplicado (`existingSend`) no bloco de auto-send (linhas 819-827 de `deploy/backend/src/routes/email.ts`). Assim, **toda vez** que o webhook `register_email` chegar com a tag correspondente, o e-mail da campanha será enviado novamente.

## Arquivo alterado

**`deploy/backend/src/routes/email.ts`** — Dentro do bloco auto-send (linhas ~819-827):

Remover este trecho:
```typescript
// Check if already sent to this contact for this campaign
const { data: existingSend } = await supabase
  .from("email_sends")
  .select("id")
  .eq("campaign_id", camp.id)
  .eq("recipient_email", normalized.email)
  .maybeSingle();

if (existingSend) continue; // Already sent
```

## Após o deploy
Na VPS, executar:
```bash
cd /root/simplificandoconversas/deploy
./update.sh
```

Depois testar enviando um novo evento de webhook com a tag da campanha para confirmar que o e-mail é disparado mesmo para contatos que já receberam anteriormente.

## Detalhe técnico
- A verificação de supressão (`isSuppressed`) permanece, garantindo que bounces/unsubscribes continuem bloqueados
- Cada envio gera um novo registro em `email_sends`, mantendo o histórico completo
- Os contadores da campanha (`sent_count`, `total_recipients`) continuam sendo incrementados normalmente

