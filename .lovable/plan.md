

# Integração Mercado Pago + Página de Transações + Gerar Boleto

## Resumo

Integrar a API do Mercado Pago ao backend para gerar cobranças (boleto e PIX) diretamente pela aplicação. Criar a página "Gerar Boleto" funcional com formulário para dados do cliente (nome, CPF, telefone, email, valor, descrição). Ao gerar, a cobrança é criada no Mercado Pago e salva automaticamente na tabela `transactions` com todos os dados do cliente. Também implementar a página de Transações com tabela, filtros e métricas. Configurar webhook do Mercado Pago para atualizar status automaticamente.

## Arquitetura

```text
Frontend (Gerar Boleto)
  └── POST /api/payment/create
        └── Backend Express
              ├── Chama API Mercado Pago (criar cobrança)
              ├── Salva na tabela transactions
              ├── Vincula ao contato via phone → conversations
              └── Retorna link de pagamento + boleto PDF

Mercado Pago (webhook IPN)
  └── POST /api/payment/webhook
        └── Backend Express
              ├── Valida assinatura
              ├── Atualiza status em transactions
              └── Opcionalmente envia mensagem WhatsApp
```

## Pré-requisito: Access Token do Mercado Pago

O usuário precisará fornecer o **Access Token de produção** do Mercado Pago (obtido em https://www.mercadopago.com.br/developers/panel/app). Será armazenado como variável de ambiente `MERCADOPAGO_ACCESS_TOKEN` no `docker-compose.yml`.

## Banco de dados

### Migration: Habilitar realtime + adicionar campo payment_url
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_url text;
```

O campo `payment_url` armazena o link de pagamento gerado pelo Mercado Pago. Os demais campos já existem: `external_id`, `amount`, `status`, `type`, `customer_*`, `metadata`, `paid_at`.

## Backend (2 arquivos novos + 1 editado)

### 1. `deploy/backend/src/routes/payment.ts` (novo, ~200 linhas)

Endpoints:
- **POST `/create`** — Cria cobrança no Mercado Pago
  - Recebe: `customer_name`, `customer_phone`, `customer_email`, `customer_document` (CPF), `amount`, `description`, `type` (boleto/pix)
  - Chama API MP: `POST https://api.mercadopago.com/v1/payments`
  - Salva na tabela `transactions` com `source: "mercadopago"`, `external_id: payment.id`
  - Cria/atualiza contato em `conversations` via phone
  - Retorna: `payment_url`, `barcode`, `qr_code`, `transaction_id`

- **POST `/webhook`** — Recebe notificações IPN do Mercado Pago
  - Evento `payment.updated`: consulta status via `GET /v1/payments/:id`
  - Atualiza `transactions.status` e `paid_at`
  - Se aprovado, pode enviar mensagem WhatsApp de confirmação

- **GET `/status/:transactionId`** — Consulta status atualizado de uma transação

### 2. `deploy/backend/src/index.ts` (editado)
- Registrar rota: `app.use("/api/payment", paymentRouter)`

### 3. `deploy/docker-compose.yml` (editado)
- Adicionar `MERCADOPAGO_ACCESS_TOKEN: ${MERCADOPAGO_ACCESS_TOKEN}` no backend

## Frontend (6 arquivos novos + 2 editados)

### 1. `src/pages/GerarBoleto.tsx` (reescrito)
- Formulário completo com campos:
  - Nome completo, CPF, Telefone, Email
  - Valor (R$), Descrição
  - Tipo: Boleto ou PIX
- Validação com máscaras (CPF, telefone, valor)
- Ao submeter: chama o endpoint `/api/payment/create`
- Exibe resultado: link de pagamento, código de barras/QR code, botão copiar
- Botão para enviar link de pagamento via WhatsApp

### 2. `src/pages/Transacoes.tsx` (reescrito)
- Cards de métricas: Total, Aprovados, Pendentes, Cancelados
- Tabela com colunas: Tipo, Cliente, Telefone, CPF, Data, Valor, Status, Ações
- Filtro por data (Hoje, 7d, 30d, Custom)
- Busca por nome/telefone/CPF
- Abas: Todos, Aprovados, Pendentes
- Badge colorido por status
- Ação: ver detalhes, copiar link de pagamento

### 3. `src/hooks/useTransactions.ts` (novo)
- Query de transações com filtro de data
- Stats calculadas por status/tipo
- Realtime via supabase channel

### 4. `src/hooks/useCreatePayment.ts` (novo)
- Mutation para criar cobrança via `/api/payment/create`
- Invalidação do cache de transações

### 5. `src/components/transactions/TransactionsTable.tsx` (novo)
- Tabela com abas, busca, ordenação

### 6. `src/components/transactions/PaymentResult.tsx` (novo)
- Componente que exibe resultado da cobrança (link, código de barras, QR)

### 7. `src/components/transactions/DateFilter.tsx` (novo)
- Filtro de data reutilizável

### 8. `src/components/transactions/StatCard.tsx` (novo)
- Card de métrica reutilizável

## Mapeamento de status Mercado Pago → Sistema

| MP Status | Status no sistema |
|-----------|-------------------|
| pending | pendente |
| approved | aprovado |
| authorized | autorizado |
| in_process | processando |
| in_mediation | em_mediacao |
| rejected | rejeitado |
| cancelled | cancelado |
| refunded | reembolsado |

## Configuração do webhook no Mercado Pago

Após o deploy, o usuário configurará no painel do Mercado Pago:
- URL: `https://API_DOMAIN/functions/v1/payment/webhook`
- Eventos: `payment`

## Nginx (sem alteração)

O proxy do Nginx já encaminha `/functions/v1/*` → backend `/api/*`, então `/functions/v1/payment/webhook` será traduzido para `/api/payment/webhook` automaticamente.

## Ordem de implementação

1. Migration (payment_url + realtime)
2. Backend: `payment.ts` + registrar no `index.ts` + env no docker-compose
3. Frontend: hooks → componentes → páginas
4. Solicitar Access Token ao usuário

