

# Integração OpenPix/Woovi — Receber webhooks de transações

## Objetivo
Adicionar OpenPix como gateway complementar ao Mercado Pago. O OpenPix será usado para receber notificações de transações PIX via webhook, registrando-as na tabela `transactions` com `source: 'openpix'`. Também permitirá gerar cobranças PIX diretamente.

## API OpenPix — Referência
- **Criar cobrança**: `POST https://api.openpix.com.br/api/openpix/v1/charge` com header `Authorization: APP_ID`
- **Payload**: `correlationID`, `value` (centavos), `comment`, `customer` (name, email, phone, taxID)
- **Resposta**: retorna `charge` com `paymentLinkUrl`, `qrCodeImage`, `brCode`
- **Webhook**: OpenPix envia POST para URL configurada quando PIX é recebido. O evento contém `charge.status` e `pix` com detalhes do pagamento

## Alterações

### 1. Frontend — Adicionar OpenPix nas Integrações
**`src/components/settings/IntegrationsSection.tsx`**
- Adicionar entrada no array `INTEGRATIONS`:
  - `platform: "openpix"`, `name: "Woovi / OpenPix"`, `icon: "🟢"`, `available: true`
  - Campo: `app_id` (App ID, tipo password)

### 2. Backend — Criar rota `/api/payment-openpix`
**`deploy/backend/src/routes/payment-openpix.ts`** (novo)

- **`POST /create`** — Cria cobrança PIX
  - Autentica usuário via JWT
  - Busca `app_id` na `platform_connections` onde `platform = 'openpix'`
  - Chama `POST https://api.openpix.com.br/api/openpix/v1/charge`
  - Salva na tabela `transactions` com `source: 'openpix'`, `type: 'pix'`
  - Retorna `payment_url`, `qr_code`, `qr_code_base64`

- **`POST /webhook`** — Recebe webhooks da OpenPix (sem autenticação JWT)
  - Evento `OPENPIX:CHARGE_COMPLETED` → atualiza `status: 'aprovado'` e `paid_at`
  - Evento `OPENPIX:CHARGE_EXPIRED` → atualiza `status: 'cancelado'`
  - Busca transação pelo `external_id` (correlationID)

### 3. Backend — Registrar rota
**`deploy/backend/src/index.ts`**
- Importar e montar: `app.use("/api/payment-openpix", openpixRouter)`

### 4. Frontend — Seletor de gateway no formulário
**`src/pages/GerarBoleto.tsx`**
- Adicionar campo "Gateway" (Mercado Pago / OpenPix)
- Se OpenPix selecionado, tipo fica fixo em "pix" (OpenPix só faz PIX)
- Chamar hook diferente conforme gateway

### 5. Hook para OpenPix
**`src/hooks/useCreatePaymentOpenpix.ts`** (novo)
- Mesmo padrão do `useCreatePayment.ts`, chamando `apiUrl("payment-openpix/create")`

### 6. Nginx — Rota de webhook
Instrução para adicionar no Nginx da VPS a rota `/functions/v1/payment-openpix/webhook` apontando para o backend, sem exigir autenticação.

## Arquivos modificados/criados
1. `src/components/settings/IntegrationsSection.tsx` — adicionar OpenPix ao catálogo
2. `deploy/backend/src/routes/payment-openpix.ts` — **novo** — rota backend
3. `deploy/backend/src/index.ts` — registrar rota
4. `src/pages/GerarBoleto.tsx` — seletor de gateway
5. `src/hooks/useCreatePaymentOpenpix.ts` — **novo** — hook frontend

## Pós-deploy (VPS)
Configurar o webhook na plataforma OpenPix apontando para:
`https://SEU_API_DOMAIN/functions/v1/payment-openpix/webhook`

