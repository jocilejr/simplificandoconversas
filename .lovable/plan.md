

## Investigação necessária

Vou clonar e ler o projeto de referência `whats-grupos` no GitHub, comparar com o nosso webhook/contagem, e propor a cópia fiel da lógica de monitoramento.

### Passo 1 — Ler o repositório externo

Via `websearch--web_code_search` e `code--fetch_website` no GitHub raw:
- `README.md` — entender arquitetura
- Webhook handler (provavelmente `routes/webhook` ou similar)
- Schema da tabela de eventos
- Endpoint/query que calcula entrou/saiu

### Passo 2 — Comparar com nosso código atual
- `deploy/backend/src/routes/groups-webhook.ts` — nosso handler
- `deploy/backend/src/routes/groups-api.ts` — endpoint GET /events + sync-stats
- `src/hooks/useGroupEvents.ts` — como o frontend consome

### Passo 3 — Diagnóstico dos 57/113 corretos vs o que está mostrando
Rodar SQL na VPS pra ver:
- Quantos eventos brutos de hoje existem (sem JOIN nenhum)
- Quantos com JOIN estrito em `(workspace_id, instance_name, group_jid)`
- Se há duplicatas por `(participant_jid, group_jid, action)` no mesmo minuto
- Distribuição por `action` (add/remove vs event name cru como `group-participants.update`)

### Hipóteses principais (antes de ler o repo)

1. **`action` está sendo salvo errado** — se o payload não tem `data.action`, nosso código usa `event` (ex: `group-participants.update`), que não bate com `add`/`remove`. Isso explicaria valores bizarros.
2. **Deduplicação por `dedup_bucket`** — o índice único pode estar descartando eventos legítimos ou não descartando retries.
3. **Filtro por instância faltando em algum lugar** — eventos de instâncias não monitoradas ainda contabilizam.
4. **Payload da Evolution tem array aninhado** diferente do que lemos.

### Plano de implementação (após leitura do repo de referência)

**A. Backend (`groups-webhook.ts`):**
- Copiar fielmente o parser do payload Evolution do repo de referência
- Garantir que `action` seja **sempre** `add` ou `remove` (normalização)
- Remover lógica que atualiza `group_daily_stats` no webhook (webhook só popula `group_participant_events`)

**B. Backend (`groups-api.ts`):**
- Substituir `GET /events` por **query agregada** que calcula entrou/saiu direto via SQL com JOIN estrito em `group_selected (workspace_id, instance_name, group_jid)` + filtro por `action IN ('add','remove')` + dedup por `(participant_jid, group_jid, action, date_trunc('minute', created_at))`
- Retornar `{ eventCounts: { add, remove }, groupCounts: {...}, events: [...] }` pronto

**C. Frontend (`useGroupEvents.ts`):**
- Parar de contar no cliente. Apenas ler `eventCounts` do backend.
- Remover `buildEventCounts` / `buildGroupCounts` (backend faz).

**D. SQL cleanup na VPS (após deploy):**
- Re-deletar eventos órfãos
- Recalcular `group_daily_stats` via backend
- Validar: `SELECT action, COUNT(*) FROM group_participant_events WHERE created_at >= hoje_brt GROUP BY action` deve bater com 113 entraram / 57 saíram

### Entregáveis desta task

1. Leitura completa de `whats-grupos` (webhook, schema, query)
2. Diff claro: "eles fazem X, nós fazemos Y, por isso divergência"
3. Reescrita de `groups-webhook.ts` + `groups-api.ts` + `useGroupEvents.ts`
4. SQL de limpeza final
5. Curl de validação pós-deploy

Sem mudança de schema (tabela `group_participant_events` continua a mesma; talvez adicionar índice de dedup se o repo externo tiver um melhor).

