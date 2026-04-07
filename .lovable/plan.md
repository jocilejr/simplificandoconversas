

# Integração Yampi — Pagamentos Aprovados e Abandono de Carrinho

## Visão Geral

Criar uma integração com a Yampi que receba webhooks de `order.paid` (pagamento aprovado) e `cart.reminder` (carrinho abandonado), persista os dados na tabela `transactions` e exiba tudo na página de Transações existente.

## Componentes

### 1. Adicionar Yampi ao Hub de Integrações (frontend)

Em `IntegrationsSection.tsx`, adicionar a Yampi ao array `INTEGRATIONS`:
- **Campos**: `secret_key` (token da API / webhook secret) e `alias` (alias da loja)
- **Webhook URL**: `/functions/v1/yampi-webhook`
- O usuário configura o webhook na Yampi apontando para essa URL

### 2. Criar rota de webhook no backend

Novo arquivo `deploy/backend/src/routes/yampi-webhook.ts`:

- **POST `/`** — Recebe webhooks da Yampi
- Valida a assinatura HMAC (header `X-Yampi-Hmac-SHA256`) usando o `secret_key` armazenado em `platform_connections`
- Identifica o workspace pelo `alias` da loja no payload
- Processa dois eventos:
  - **`order.paid`**: Cria transação com `type: "yampi"`, `status: "aprovado"`, dados do cliente e valor
  - **`cart.reminder`**: Cria transação com `type: "yampi_cart"`, `status: "abandonado"`, dados do cliente e link de recuperação no metadata

### 3. Registrar rota no backend

Em `deploy/backend/src/index.ts`:
```
import yampiWebhookRouter from "./routes/yampi-webhook";
app.use("/api/yampi-webhook", yampiWebhookRouter);
```

### 4. Configurar Nginx

Em `deploy/nginx/default.conf.template`, adicionar proxy pass para `/functions/v1/yampi-webhook` → `/api/yampi-webhook`.

### 5. Exibir na página de Transações

Em `TransactionsTable.tsx`, adicionar suporte aos novos tipos:
- `yampi` aparece como "Yampi" com badge verde (aprovado)
- `yampi_cart` aparece como "Carrinho Abandonado" com badge laranja
- Na aba de pendentes, adicionar filtro "Yampi" junto com Boleto/PIX/Cartão

### 6. Persistência — nenhuma migração necessária

Os dados usam a tabela `transactions` existente com:
- `type`: `"yampi"` ou `"yampi_cart"`
- `source`: `"yampi"`
- `external_id`: ID do pedido/carrinho da Yampi
- `metadata`: payload completo para referência

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/settings/IntegrationsSection.tsx` | Adicionar Yampi ao catálogo |
| `deploy/backend/src/routes/yampi-webhook.ts` | **Novo** — webhook handler |
| `deploy/backend/src/index.ts` | Registrar rota |
| `deploy/nginx/default.conf.template` | Proxy pass |
| `src/components/transactions/TransactionsTable.tsx` | Exibir tipos yampi/yampi_cart |

## Deploy na VPS

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend && docker compose restart nginx
```

