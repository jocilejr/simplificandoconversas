

## Sistema de Transações Financeiras

Importar a funcionalidade de visualização de transações da aplicação financeira para este projeto, adaptada para receber dados de Mercado Pago, OpenPix, Yampi e outros via webhook.

### Arquitetura

```text
Mercado Pago / OpenPix / Yampi
         │ (webhook POST)
         ▼
  Backend VPS (/api/webhook-transactions)
         │
         ▼
   Tabela "transactions" (banco)
         │
         ▼
   Frontend (página /transacoes)
```

### Fase 1: Banco de Dados

Criar tabela `transactions`:
- `id`, `user_id`, `external_id`, `source` (mercadopago/openpix/yampi/manual)
- `type` (pix/boleto/cartao), `status` (pendente/pago/cancelado/expirado)
- `amount`, `description`, `customer_name`, `customer_email`, `customer_phone`, `customer_document`
- `created_at`, `paid_at`, `metadata` (jsonb)
- RLS: usuário autenticado gerencia seus próprios registros

### Fase 2: Rota de Webhook no Backend VPS

Criar `deploy/backend/src/routes/webhook-transactions.ts`:
- Endpoint `POST /api/webhook-transactions/:source` (source = mercadopago, openpix, yampi)
- Normaliza o payload de cada plataforma para o formato unificado da tabela
- Mapeia campos específicos de cada plataforma:
  - **Mercado Pago**: `action`, `data.id` -> busca detalhes via API se necessário
  - **OpenPix**: `event`, `charge` -> mapeia status e valores
  - **Yampi**: `event`, `resource` -> mapeia pedidos e status
- Insere/atualiza na tabela `transactions` via service_role

### Fase 3: Frontend

1. **Hook `useTransactions.ts`**
   - Query com filtro de datas (mesmo padrão do dashboard)
   - Estatísticas calculadas: total por tipo, por status, volume

2. **Página `Transacoes.tsx`**
   - Filtro de período (Hoje/Ontem/Personalizado)
   - Cards de resumo: Total recebido, Pendentes, Por tipo de pagamento
   - Tabela de transações com busca, filtro por tipo/status/source
   - Badge colorido por status e ícone por source

3. **Sidebar**: Adicionar item "Transações" com ícone `DollarSign`

4. **Rota**: `/transacoes` no App.tsx

### Fase 4: Importação via Planilha

- Botão "Importar" na página de transações
- Upload de CSV/XLSX com colunas: tipo, valor, status, nome_cliente, email, telefone, documento, data
- Parse no frontend, envio em batch para o banco

### Implementação (arquivos)

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabela `transactions` |
| `deploy/backend/src/routes/webhook-transactions.ts` | Nova rota webhook |
| `deploy/backend/src/index.ts` | Registrar nova rota |
| `src/hooks/useTransactions.ts` | Hook de dados |
| `src/pages/Transacoes.tsx` | Página principal |
| `src/components/transactions/TransactionsTable.tsx` | Tabela com filtros |
| `src/components/transactions/ImportTransactions.tsx` | Modal de importação |
| `src/components/AppSidebar.tsx` | Novo item no menu |
| `src/App.tsx` | Nova rota |

### Observações

- O webhook na VPS precisa ser acessível externamente (já é via nginx)
- Cada plataforma terá sua URL de webhook: `https://api.chatbotsimplificado.com/api/webhook-transactions/mercadopago`
- A configuração das credenciais de cada plataforma (tokens de validação) será feita na página de Configurações

