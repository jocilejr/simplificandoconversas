

# Corrigir webhook OpenPix — Criar transação quando não existe

## Problema
O webhook da OpenPix apenas faz `UPDATE` na tabela `transactions` buscando pelo `external_id` (correlationID). Se a cobrança foi criada diretamente no painel da OpenPix (e não pelo nosso sistema), não existe nenhuma transação correspondente no banco. O `UPDATE` afeta zero linhas e a transação nunca aparece.

## Solução
Alterar o handler do webhook `OPENPIX:CHARGE_COMPLETED` para:
1. Tentar o `UPDATE` normalmente
2. Se nenhuma linha foi atualizada (`count === 0`), fazer `INSERT` de uma nova transação com os dados do payload do webhook
3. Extrair dados do cliente (`charge.customer`) e valor (`charge.value` em centavos → reais) do payload

## Alteração

### `deploy/backend/src/routes/payment-openpix.ts` — webhook handler

No bloco `OPENPIX:CHARGE_COMPLETED`:
- Capturar o resultado do `UPDATE` e verificar `count`
- Se `count === 0`, identificar o `user_id` pela busca na `platform_connections` usando dados do webhook (ou buscar todas as conexões openpix ativas)
- Inserir nova transação com:
  - `source: 'openpix'`
  - `type: 'pix'`
  - `status: 'aprovado'`
  - `paid_at` do payload
  - `amount: charge.value / 100` (centavos → reais)
  - `customer_name`, `customer_email`, `customer_phone`, `customer_document` do `charge.customer`
  - `external_id: correlationID`
  - `payment_url: charge.paymentLinkUrl`

Para o `OPENPIX:CHARGE_EXPIRED`, aplicar a mesma lógica (inserir com `status: 'cancelado'` se não existir).

### Problema do `user_id`
O webhook não carrega JWT. Para associar ao usuário correto:
- Extrair o `user_id` do próprio `correlationID` (formato atual: `{userId}-{timestamp}-{random}`)
- Se o correlationID não contiver o userId (cobrança criada fora do sistema), buscar na `platform_connections` qual usuário tem `platform = 'openpix'` com o `app_id` correspondente (usando header `Authorization` do webhook ou iterando conexões ativas)
- Fallback: buscar o primeiro usuário com conexão openpix ativa

### Arquivo modificado
1. `deploy/backend/src/routes/payment-openpix.ts` — lógica de upsert no webhook

### Pós-deploy (VPS)
```bash
docker compose up -d --build backend
```

