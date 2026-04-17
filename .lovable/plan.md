

## Diagnóstico

O código **atual já tem a lógica correta** após as últimas mudanças:

- **Webhook** (`groups-webhook.ts`): filtra por `(workspace_id, instance_name, group_jid)` — só registra eventos de tuplas monitoradas. ✅
- **GET /events**: JOIN estrito com `group_selected` pela mesma tupla. ✅
- **Sync horário** (`syncAllWorkspacesStats`): cron a cada 1h via `findGroupInfos`. ✅
- **Migração** adicionou `member_count_updated_at`. ✅

**Então por que continua inconsistente?** Três problemas residuais:

1. **Dados históricos poluídos** — `group_participant_events` contém eventos antigos de tuplas `(instância, grupo)` que nunca deveriam ter sido registrados (ex: eventos da instância Y em grupos selecionados só pela X, antes do filtro existir).
2. **`group_daily_stats` também poluído** — contadores somaram eventos órfãos.
3. **`member_count` ainda desatualizado** (snapshot de 16/04) porque o cron de 1h ainda não rodou (primeiro disparo só 1h após deploy).

## Plano: reset cirúrgico + força de sync inicial

### 1. Backend — disparar sync na inicialização (não só após 1h)

Arquivo `deploy/backend/src/index.ts` — alterar `setInterval` para:
- Executar **imediatamente** ao subir (com delay de 30s para o Express ficar pronto)
- Manter intervalo de 1h para execuções subsequentes

Motivo: hoje o primeiro sync só acontece 1h após deploy, então o `member_count` fica impreciso todo esse tempo. Com disparo inicial, dashboards ficam corretos já no restart.

### 2. Script SQL de reset (executado via SSH na VPS após deploy)

```sql
-- 2a) Deletar eventos órfãos (tuplas não monitoradas)
DELETE FROM group_participant_events e
WHERE NOT EXISTS (
  SELECT 1 FROM group_selected s
  WHERE s.workspace_id = e.workspace_id
    AND s.instance_name = e.instance_name
    AND s.group_jid   = e.group_jid
);

-- 2b) Limpar daily_stats e recalcular a partir dos eventos válidos restantes
TRUNCATE group_daily_stats;

INSERT INTO group_daily_stats (workspace_id, date, group_jid, group_name, additions, removals, total_members)
SELECT
  e.workspace_id,
  ((e.created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS date,
  e.group_jid,
  COALESCE(MAX(s.group_name), e.group_jid) AS group_name,
  COUNT(*) FILTER (WHERE e.action = 'add')    AS additions,
  COUNT(*) FILTER (WHERE e.action = 'remove') AS removals,
  0 AS total_members
FROM group_participant_events e
LEFT JOIN group_selected s
  ON s.workspace_id = e.workspace_id
 AND s.instance_name = e.instance_name
 AND s.group_jid    = e.group_jid
GROUP BY e.workspace_id, date, e.group_jid;
```

### 3. Disparar sync manual pós-deploy (1 comando curl)

```bash
WS_ID=$(docker exec deploy-postgres-1 psql -U postgres -d postgres -tAc \
  "SELECT id FROM workspaces LIMIT 1;")
curl -s -X POST http://localhost:3000/api/groups/sync-stats \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\":\"$WS_ID\"}" | head -80
```

Atualiza `member_count` real-time sem esperar 1h.

### 4. Validação

```sql
-- Devem retornar 0
SELECT COUNT(*) FROM group_participant_events e
WHERE NOT EXISTS (SELECT 1 FROM group_selected s
  WHERE s.workspace_id=e.workspace_id AND s.instance_name=e.instance_name AND s.group_jid=e.group_jid);

-- Entradas/saídas de hoje por tupla monitorada
SELECT s.instance_name, e.group_jid, e.action, COUNT(*)
FROM group_participant_events e
JOIN group_selected s
  ON s.workspace_id=e.workspace_id AND s.instance_name=e.instance_name AND s.group_jid=e.group_jid
WHERE e.created_at >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date) AT TIME ZONE 'America/Sao_Paulo'
GROUP BY 1,2,3 ORDER BY 1,2,3;

-- member_count atualizado
SELECT group_name, instance_name, member_count, member_count_updated_at
FROM group_selected ORDER BY member_count_updated_at DESC NULLS LAST;
```

Os números em `eventCounts` do dashboard devem bater exatamente com a segunda query.

## Mudanças de arquivo

- **`deploy/backend/src/index.ts`** — disparar `syncAllWorkspacesStats()` 30s após boot (além do interval de 1h).

Sem mudanças de schema, sem migração SQL nova, sem nova lógica de webhook/events (ambos já corretos). Após deploy, você roda o bloco SQL de reset + o curl de sync e o monitoramento fica preciso.

