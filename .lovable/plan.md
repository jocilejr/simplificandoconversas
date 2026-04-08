

# Refatorar Yampi: webhook via n8n + mini documentação

## Resumo

Simplificar o webhook Yampi para receber eventos pré-processados via n8n (removendo HMAC, busca de connections e matching por alias). Adicionar mini documentação inline no card de integração.

## Mudanças

### 1. `deploy/backend/src/routes/yampi-webhook.ts`
- Remover import de `crypto`
- Remover toda lógica de busca em `platform_connections` (linhas 78-92)
- Remover validação HMAC (linhas 95-116)
- Receber `workspace_id` e `user_id` diretamente do body (enviados pelo n8n)
- Validar que ambos existem no body, retornar 400 se ausentes
- Manter toda a lógica de negócio (extractCustomer, mapPaymentType, dedup, insert, dispatchRecovery)

### 2. `deploy/backend/src/index.ts`
- Remover o bloco `verify` do `express.json()` que salva `rawBody` (não mais necessário)

### 3. `src/components/settings/IntegrationsSection.tsx`
- Remover campos `secret_key` e `alias` da integração Yampi (fields vazio)
- Atualizar descrição para "Pagamentos e carrinho abandonado via n8n"
- Adicionar bloco de mini documentação (similar ao `manual_payment` e `mercadopago`) com:
  - Método: POST
  - Campos obrigatórios: `event`, `workspace_id`, `user_id`, `resource`
  - Eventos suportados: `order.paid`, `transaction.payment.refused`, `cart.reminder`
  - Exemplo de payload JSON
  - Nota explicando que o n8n recebe da Yampi e repassa para esta URL

### 4. `deploy/nginx/default.conf.template`
- Adicionar `location = /functions/v1/yampi-webhook` (sem trailing slash) no APP_DOMAIN antes do bloco existente
- Adicionar blocos equivalentes (com e sem trailing slash) no API_DOMAIN antes do catch-all `/functions/v1/`

## Deploy
```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend --force-recreate nginx
```

