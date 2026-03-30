

## API REST Bidirecional para Gestão Financeira

### Visão Geral

Criar um conjunto de endpoints REST no backend Express (`/api/platform/`) autenticados por token estático (API Key), permitindo que sua aplicação de gestão financeira envie e receba dados de contatos, transações, tags e lembretes.

### Autenticação

- Gerar um token único por usuário, armazenado na tabela `platform_connections` (campo `credentials`)
- Cada request da plataforma externa envia o header `X-API-Key: <token>`
- O backend valida o token, resolve o `user_id` e executa a operação

### Endpoints da API

**Contatos/Clientes:**
- `GET /api/platform/contacts` — listar contatos (com filtros: phone, name, instance)
- `POST /api/platform/contacts` — criar/atualizar contato (upsert por phone)
- `GET /api/platform/contacts/:phone` — detalhes de um contato

**Transações/Pagamentos:**
- `GET /api/platform/transactions` — listar transações (filtros: status, date range)
- `POST /api/platform/transactions` — criar transação
- `PATCH /api/platform/transactions/:id` — atualizar status de transação
- `POST /api/platform/transactions/webhook` — receber notificação de mudança de status

**Tags/Segmentação:**
- `GET /api/platform/tags?phone=X` — listar tags de um contato
- `POST /api/platform/tags` — adicionar tag a um contato
- `DELETE /api/platform/tags` — remover tag de um contato

**Lembretes:**
- `GET /api/platform/reminders` — listar lembretes (filtros: pending, overdue, today)
- `POST /api/platform/reminders` — criar lembrete
- `PATCH /api/platform/reminders/:id` — marcar como concluído

### Arquivos a Criar/Modificar

1. **`deploy/backend/src/routes/platform-api.ts`** (novo) — todos os endpoints acima com middleware de autenticação por API Key
2. **`deploy/backend/src/index.ts`** — registrar `app.use("/api/platform", platformApiRouter)`
3. **`deploy/nginx/default.conf.template`** — adicionar rota `/api/platform` (se necessário, verificar se `/api/` já é roteado)

### Geração de API Key

- Endpoint `POST /api/ext/generate-platform-key` (autenticado pelo GoTrue, para uso na UI/extensão) que gera um token `crypto.randomBytes(32).toString("hex")` e salva em `platform_connections` com `platform = "custom_api"`
- Endpoint `GET /api/ext/platform-key` para consultar a key existente

### Segurança

- Rate limiting simples por IP (in-memory, com aviso)
- Validação de input com checagens manuais (body fields obrigatórios, tipos)
- Todas as queries filtradas por `user_id` resolvido pelo token

### UI (opcional, pode ser feito depois)

- Na página de Configurações, seção "API de Integração" mostrando a API Key gerada e documentação dos endpoints disponíveis

