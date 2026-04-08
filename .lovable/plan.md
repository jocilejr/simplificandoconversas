

# Fix: Dashboard da extensão Chrome filtrado por workspace

## Problema
O endpoint `GET /api/ext/dashboard` no backend (`deploy/backend/src/routes/extension-api.ts`) ignora o parâmetro `workspaceId` enviado pela extensão. Todas as queries filtram por `user_id`, mostrando dados de todos os workspaces misturados.

A extensão já envia `workspaceId` corretamente (linha 304 do `background.js`), mas o backend não o utiliza.

## Solução

**Arquivo:** `deploy/backend/src/routes/extension-api.ts` (linhas 91-167)

1. Ler `workspaceId` do query param (`req.query.workspaceId`) com fallback para `resolveWorkspaceId(userId)`
2. Substituir todos os `.eq("user_id", userId)` por `.eq("workspace_id", workspaceId)` nas 6 queries paralelas e nas queries de enriquecimento

Queries afetadas:
- `chatbot_flows` → filtrar por `workspace_id`
- `conversations` → filtrar por `workspace_id`
- `flow_executions` (count + recent) → filtrar por `workspace_id`
- `whatsapp_instances` → filtrar por `workspace_id`
- `reminders` → filtrar por `workspace_id`
- Lookup de `conversations` para enriquecimento → filtrar por `workspace_id`

Nenhuma mudança na extensão Chrome é necessária — ela já envia o `workspaceId` correto.

