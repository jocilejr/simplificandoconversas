

## Diagnóstico

Hoje o filtro do webhook em `groups-webhook.ts` (passo 1 que já fiz) checa se `(workspace_id, group_jid)` existe em `group_selected` — mas **ignora `instance_name`**. Resultado: se a instância Y também é membro do grupo 1 (selecionado pela X), o webhook da Y registra evento como se fosse monitorado.

Regra correta: evento só conta quando a tupla **(workspace_id, instance_name, group_jid)** existe em `group_selected`.

Mesma regra deve valer no frontend (`useGroupEvents`) e nas queries do dashboard (members + entradas/saídas).

Há também o problema separado de **member_count desatualizado** (snapshot antigo de 16/04). Precisa sync real-time confiável.

## Plano de correção

### 1. Backend: filtro estrito por instância no webhook

Arquivo `deploy/backend/src/routes/groups-webhook.ts` — mudar checagem de `group_selected` para incluir `instance_name`:

```ts
// antes (errado): WHERE workspace_id=$1 AND group_jid=$2
// depois (correto): WHERE workspace_id=$1 AND instance_name=$2 AND group_jid=$3
```

Eventos de instância não-monitorada para aquele grupo são **ignorados silenciosamente** (não inseridos em `group_participant_events`).

### 2. Backend: novo endpoint `POST /api/groups/sync-stats` real-time

Reescrever para:
- Buscar TODAS as rows de `group_selected` do workspace
- Para cada `(instance_name, group_jid)`, chamar Evolution `findGroupInfos` (mais confiável que `fetchAllGroups` para grupos onde bot não é admin)
- Atualizar `member_count` da row exata `(workspace_id, instance_name, group_jid)`
- Adicionar coluna `member_count_updated_at` (migração)
- Retornar `{ synced, failed, errors[] }`

### 3. Backend: endpoint `GET /api/groups/events` com filtro de instância

Aceitar parâmetros `workspaceId`, `start`, `end` e ignorar `groupJids` enviado pelo frontend. Em vez disso, derivar internamente:
```sql
SELECT e.* FROM group_participant_events e
INNER JOIN group_selected s
  ON s.workspace_id = e.workspace_id
  AND s.instance_name = e.instance_name
  AND s.group_jid = e.group_jid
WHERE e.workspace_id = $1
  AND e.created_at BETWEEN $2 AND $3
ORDER BY e.created_at DESC
```
Garante: só retorna eventos de combinações `(instância, grupo)` ainda monitoradas.

### 4. Frontend: `useGroupEvents.ts`

Remover parâmetro `monitoredJids` (deixar backend filtrar). Frontend só passa workspace + range.

### 5. Frontend: `GroupDashboardTab.tsx`

- **Total de Membros:** somar `member_count` de TODAS as rows (cada `(instância, grupo)` é monitoramento independente — se grupo 1 está em X e Y selecionados, conta 2x intencionalmente, refletindo "monitoramentos ativos"). Adicionar tooltip explicando.
- **Entraram/Saíram:** já vem filtrado correto do backend.
- **Auto-sync ao montar:** já existe (`useEffect` chamando `syncStats(true)`). Manter.
- Mostrar timestamp da última sync (`member_count_updated_at` mais recente).

### 6. Migração SQL

```sql
ALTER TABLE group_selected
  ADD COLUMN IF NOT EXISTS member_count_updated_at timestamptz;
```

### 7. Limpeza retroativa de eventos órfãos (executada via script SQL na VPS)

Após deploy, rodar:
```sql
DELETE FROM group_participant_events e
WHERE NOT EXISTS (
  SELECT 1 FROM group_selected s
  WHERE s.workspace_id = e.workspace_id
    AND s.instance_name = e.instance_name
    AND s.group_jid = e.group_jid
);
```
Isso remove eventos de combinações `(instância, grupo)` que nunca deveriam ter sido registradas (eventos de instância Y para grupos selecionados só pela X).

### 8. Recalcular `group_daily_stats`

Após limpeza, reexecutar o INSERT dos últimos 7 dias (mesmo SQL do passo anterior).

## Dados preservados

- `group_selected` mantido (apenas adiciona coluna nova)
- `group_participant_events` apenas perde rows órfãs (que nunca deveriam ter sido registradas)
- `member_count` atualiza no primeiro auto-sync após deploy

## Validação pós-deploy

1. SQL: confirmar zero eventos órfãos restantes
2. Frontend: card "Entraram/Saíram" deve bater com query SQL filtrada por `(instance_name, group_jid)`
3. Frontend: `member_count` por grupo deve refletir realidade da Evolution (validar 2-3 grupos manualmente via Evolution API)
4. Webhook: simular evento da instância Y em grupo só selecionado pela X → não deve aparecer em `group_participant_events`

