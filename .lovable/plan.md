

## Webhook dedicado para Boletos (Mercado Pago IPN)

### Problema

O webhook atual (`/api/payment/webhook`) usa um `MERCADOPAGO_ACCESS_TOKEN` global, o que nao funciona em ambientes multi-usuario. Alem disso, quando o boleto e pago, o sistema nao atualiza corretamente a transacao porque nao resolve o token do usuario dono do pagamento.

### Solucao

Criar um endpoint dedicado `/api/payment/webhook/boleto` que:

1. Recebe o IPN do Mercado Pago (formato `{ resource, topic }` no body ou `{ id, topic }` na query)
2. Busca a transacao no banco pelo `external_id` = payment ID para descobrir o `user_id`
3. Usa o token do Mercado Pago **do usuario** (via `platform_connections`)
4. Consulta a API do MP para obter status completo
5. Atualiza a transacao com status, `paid_at`, metadata (merge)
6. Se status mudou para `aprovado`, remove da `recovery_queue`
7. Se status e `pendente` e nao esta na fila, enfileira para recovery

### Fluxo

```text
Mercado Pago IPN
  → POST /api/payment/webhook/boleto
  → Extrai payment_id do body.resource ou query.id
  → Busca transacao no banco por external_id
  → Resolve MP token do user_id
  → GET MP API /v1/payments/{id}
  → Atualiza transacao (status, paid_at, metadata merge)
  → Se aprovado: remove da recovery_queue
  → Se pendente: enfileira recovery
  → Retorna 200
```

### Mudancas

| Arquivo | Acao |
|---------|------|
| `deploy/backend/src/routes/payment.ts` | Adicionar rota `POST /webhook/boleto` com resolucao per-user do token MP |

Nenhum arquivo novo. A rota fica no mesmo router de payment, usando `getMPTokenForUser` e `STATUS_MAP` que ja existem.

### Detalhes da rota

- **Sem autenticacao**: webhooks do MP sao publicos (mesmo padrao do webhook existente)
- **Idempotente**: se o status ja e o mesmo, nao faz nada
- **Fallback**: se nao encontrar a transacao pelo `external_id`, tenta pelo `resource` na query
- **Recovery**: se o pagamento foi aprovado, deleta da `recovery_queue`. Se pendente e nao enfileirado, enfileira
- **Log**: registra em `console.log` para debug na VPS

