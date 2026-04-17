

## Mudanças

### 1. Frontend — `GroupDashboardTab.tsx`
- Remover botão "Sincronizar" e estado `syncing`/`syncedRef`
- Remover toda função `syncStats` e seu `useEffect` de auto-sync
- Manter apenas o seletor de período (Hoje/Ontem/Personalizado)

### 2. Backend — `deploy/backend/src/index.ts`
- Adicionar cron interno que executa a cada 1h:
  - Marcar timestamp de boot do processo (`SYNC_START_AT = Date.now()`)
  - `setInterval(() => syncAllWorkspaces(), 60*60*1000)` — primeira execução só após 1h do boot (não no boot, conforme pedido: "data inicial o horário do deploy")
- Função `syncAllWorkspaces()`:
  - `SELECT DISTINCT workspace_id FROM group_selected`
  - Para cada workspace, chamar internamente a mesma lógica do `POST /sync-stats` (extrair em helper `syncWorkspaceStats(workspaceId)` em `groups-api.ts` e exportar)

### 3. Backend — `groups-api.ts`
- Extrair lógica do handler `POST /sync-stats` para função exportada `syncWorkspaceStats(workspaceId): Promise<{synced, failed, errors}>`
- Handler HTTP continua existindo (caso seja útil para debug manual via curl), mas o frontend não chama mais

### Observação
O endpoint `POST /api/groups/sync-stats` permanece no backend para uso manual via curl. O frontend simplesmente não o invoca mais. Sem mudanças de schema, sem nova migração SQL.

