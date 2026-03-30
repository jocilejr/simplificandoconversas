

# Integração Mercado Pago — Plano

## Problema atual

O normalizador do Mercado Pago no backend (`webhook-transactions.ts`) assume que o webhook já traz os dados completos do pagamento. Na realidade, o **Mercado Pago envia apenas uma notificação** com `action` e `data.id` (o ID do pagamento). É necessário **buscar os detalhes na API do MP** usando o `access_token` do usuário.

## O que será feito

### 1. Alterar `webhook-transactions.ts` — buscar pagamento na API do MP

Quando o webhook do Mercado Pago chegar:
1. Extrair `data.id` (payment ID) do payload
2. Buscar o `access_token` do usuário na tabela `platform_connections` (usando `user_id` da query string)
3. Fazer `GET https://api.mercadopago.com/v1/payments/{id}` com o token
4. Normalizar a resposta completa da API (que contém `status`, `transaction_amount`, `payer`, etc.)
5. Inserir/atualizar na tabela `transactions`

### 2. Tratar os status corretamente

Mapear os status reais da API do MP:
- `approved` → `pago`
- `pending` / `in_process` → `pendente`
- `rejected` / `cancelled` → `cancelado`
- `refunded` / `charged_back` → `reembolsado`

### 3. Mapear tipo de pagamento

- `credit_card` / `debit_card` → `cartao`
- `bank_transfer` / `pix` → `pix`
- `ticket` (boleto) → `boleto`

## Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `deploy/backend/src/routes/webhook-transactions.ts` | Reescrever `normalizeMercadoPago` para buscar dados na API do MP usando `access_token` da `platform_connections` |

## Detalhes técnicos

```text
Webhook MP payload (o que chega):
{
  "action": "payment.updated",
  "data": { "id": "123456789" }
}

→ Backend busca: GET https://api.mercadopago.com/v1/payments/123456789
   Header: Authorization: Bearer {access_token}

→ Resposta completa com: status, transaction_amount, payer, payment_type_id, etc.
```

O `access_token` será lido do banco:
```sql
SELECT credentials->>'access_token'
FROM platform_connections
WHERE user_id = :user_id AND platform = 'mercadopago'
```

