

## Escopo

Reconstruir o sistema de eventos (add/remove) com nova tabela dedicada `group_events`, e reorganizar a aba "Visão Geral" para mostrar o **visualizador de postagens (eventos por grupo)** como primeiro item ao abrir.

## Pipeline novo

**Gravação:** Webhook Evolution → resolve `workspace → instance → group_selected` → INSERT cru em `group_events`. Descarta com log se a tripla não bate.

**Leitura:** 1 endpoint `GET /api/groups/events` → SQL bruto via `pg.Pool` (sem PostgREST/limit) → retorna `{ totals, groups[] }`.

## Tabela nova

```sql
DROP TABLE IF EXISTS group_participant_events CASCADE;

CREATE TABLE group_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  instance_name   text NOT NULL,
  group_jid       text NOT NULL,
  group_name      text,
  participant_jid text NOT NULL,
  action          text NOT NULL CHECK (action IN ('add','remove')),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  raw_payload     jsonb
);
CREATE INDEX ON group_events (workspace_id, occurred_at DESC);
CREATE INDEX ON group_events (workspace_id, instance_name, group_jid, action);
NOTIFY pgrst, 'reload schema';
```

## Backend

- **Reescrever** `deploy/backend/src/routes/groups-webhook.ts`: pipeline workspace→instance→group_selected, INSERT cru em `group_events`, logs estruturados de descarte.
- **Em** `deploy/backend/src/routes/groups-api.ts`: remover `/events` e `/events-summary` antigos. Criar `GET /events` novo com SQL único:

```sql
SELECT e.group_jid, s.group_name,
  COUNT(*) FILTER (WHERE e.action='add')    AS adds,
  COUNT(*) FILTER (WHERE e.action='remove') AS removes
FROM group_events e
JOIN group_selected s
  ON s.workspace_id=e.workspace_id
 AND s.instance_name=e.instance_name
 AND s.group_jid=e.group_jid
WHERE e.workspace_id=$1 AND e.occurred_at>=$2 AND e.occurred_at<$3
GROUP BY e.group_jid, s.group_name
ORDER BY s.group_name;
```

Retorno: `{ window, totals: {adds,removes}, groups: [{group_jid,group_name,adds,removes}] }`.

## Frontend

- **Reescrever** `src/hooks/useGroupEvents.ts`: 1 chamada, retorna `totals` + `groups`. Sem normalização/dedup no front.
- **Atualizar** `src/components/grupos/GroupDashboardTab.tsx`, nova ordem de cima pra baixo:
  1. **Visualizador de postagens (eventos por grupo)** — lista `groups[]` com nome + `+adds` / `−removes` por grupo selecionado. **Primeiro item.**
  2. Filtro de período (Hoje/Ontem/Personalizado) + botão Sincronizar
  3. Cards de estatísticas (Grupos Monitorados, Total Membros, Campanhas Ativas, Enviadas Hoje, Entraram=`totals.adds`, Saíram=`totals.removes`)
  4. SchedulerDebugPanel
  5. Card "Grupos Monitorados" (lista crua de selecionados)
  
  **Remover** a seção "Eventos — Hoje" (feed cronológico) — substituída pelo visualizador agregado por grupo.

## Execução

1. Lovable aplica: migração + reescrita backend + reescrita hook + reorganização da Visão Geral.
2. Você roda na VPS (envio comandos prontos no próximo turno):
   - `cd ~/simplificandoconversas && git pull && bash deploy/update.sh`
   - SQL DROP+CREATE da nova tabela
   - Validação: comparar `SELECT action,COUNT(*) FROM group_events WHERE workspace_id=...` com o JSON do endpoint.

## Risco

DROP de `group_participant_events` apaga histórico atual. Confirmado implicitamente nas iterações anteriores. Se quiser preservar, troco DROP por RENAME — me avisa antes de aprovar.

