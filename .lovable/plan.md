

# Isolamento Total de Dados por Workspace

## Problema

Atualmente, há vazamento de dados entre workspaces em dois pontos principais:

1. **Conexões WhatsApp**: O backend `fetch-instances` busca TODAS as instâncias da Evolution API e as associa ao usuário (não ao workspace). As queries no backend filtram por `user_id` sem considerar `workspace_id`. O `resolveWorkspaceId()` pega o PRIMEIRO workspace do usuário, ignorando qual está ativo.

2. **Integrações**: O `IntegrationsSection` carrega `platform_connections` filtrado apenas por `user_id`, sem filtrar por `workspace_id`. Isso faz Mercado Pago, OpenPix etc. aparecerem em todos os workspaces.

## Plano de Correção

### 1. Frontend: Passar `workspaceId` em todas as chamadas

**`src/hooks/useWhatsAppInstances.ts`**
- Já passa `workspaceId` no `fetch-instances` — OK
- Adicionar `workspaceId` em `create-instance`, `delete-instance`, `sync-chats`, `logout-instance` e demais actions

**`src/components/settings/IntegrationsSection.tsx`**  
- Trocar `loadConnections` para filtrar por `workspace_id` em vez de `user_id`
- Na inserção, já usa `workspace_id` — OK
- Corrigir a query SELECT: `.eq("workspace_id", workspaceId)` em vez de `.eq("user_id", user.id)`

**`src/components/settings/ConnectionsSection.tsx`**
- Adicionar `workspaceId` na chamada de `sync-chats`
- Na exclusão em massa (handleDeleteAllConversations), filtrar por `workspace_id`

### 2. Backend: Filtrar por `workspace_id` recebido do frontend

**`deploy/backend/src/lib/workspace.ts`**  
- Adicionar função `resolveWorkspaceIdFromRequest(body, userId)` que prioriza o `workspaceId` enviado pelo frontend, com fallback para o método atual

**`deploy/backend/src/routes/whatsapp-proxy.ts`**
- Usar `workspaceId` do body quando disponível: `const workspaceId = body.workspaceId || await resolveWorkspaceId(userId)`
- **`fetch-instances`**: Filtrar instâncias do DB por `workspace_id` (não `user_id`). Só popular instâncias no DB para o workspace ativo
- **`create-instance`**: Usar o `workspaceId` do body
- **`delete-instance`**: Filtrar delete por `workspace_id`
- **`sync-chats`**: Filtrar por `workspace_id`
- **Active instance queries**: Adicionar `.eq("workspace_id", workspaceId)` em todas

### 3. Resumo de arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/settings/IntegrationsSection.tsx` | Filtrar por `workspace_id` no SELECT |
| `src/components/settings/ConnectionsSection.tsx` | Passar `workspaceId` em sync/delete-all |
| `src/hooks/useWhatsAppInstances.ts` | Passar `workspaceId` em todas as mutations |
| `deploy/backend/src/routes/whatsapp-proxy.ts` | Usar `workspaceId` do body, filtrar queries por workspace |
| `deploy/backend/src/lib/workspace.ts` | Helper para priorizar workspaceId do request |

### Instruções para VPS após deploy

Rebuildar backend e frontend normalmente. Não há mudanças de schema — as tabelas já têm `workspace_id`.

