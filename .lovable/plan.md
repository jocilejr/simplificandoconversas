

## Diagnóstico do problema (com base nos dados que você já me mandou)

**O que vimos no SQL anterior:**
- ✅ Workspace isolation: OK (0 grupos compartilhados entre workspaces)
- ✅ Ações inválidas: 0 (webhook normalizando certo)
- ⚠️ **15 eventos órfãos** em 6 tuplas `(workspace, instance, group)` que **não estão** em `group_selected`

**Por que ainda dá inconsistência (113 entraram / 57 saíram que você espera vs o que aparece):**

Os 15 órfãos sozinhos não explicam a diferença. Logo, há outro fator. As 3 hipóteses restantes são:

1. **Janela de tempo BRT vs UTC** — `useGroupEvents` calcula "hoje" em BRT mas o backend pode estar comparando como string UTC. Se um evento chega às 23:30 BRT (= 02:30 UTC do dia seguinte), ele some do "hoje".
2. **Duplicatas legítimas da Evolution** — a Evolution pode disparar o mesmo `group-participants.update` 2-3x (retry). Sem dedup, contamos 3 onde houve 1.
3. **Endpoint `/events-summary` paginando errado** — se algum loop quebra no meio, o total fica menor.

## Plano de correção (3 passos cirúrgicos)

### Passo 1 — Limpeza dos órfãos (SQL na VPS, 1 comando)
Remover os 15 eventos que não pertencem a nenhuma tupla monitorada. Isso já alinha parte da contagem.

### Passo 2 — Adicionar deduplicação no backend
Em `groups-api.ts`, dentro de `/events-summary` e `/events`, agrupar por `(participant_jid, group_jid, action, date_trunc('minute', created_at))` antes de contar. Eventos duplicados pelo retry da Evolution viram 1 só.

### Passo 3 — Diagnóstico final dos números
Rodar SQL que mostra **exatamente** o que o backend deveria retornar:
- Total bruto hoje (BRT)
- Total após dedup por minuto
- Comparar com o que a tela mostra

Se após dedup bater com 113/57, problema resolvido. Se não bater, te mando o próximo passo (provavelmente ajuste de timezone no `useGroupEvents`).

## Mudanças de código

- **`deploy/backend/src/routes/groups-api.ts`** — adicionar dedup por `(participant_jid, group_jid, action, minute)` em `/events-summary` e `/events`.
- **Sem mudança de schema, sem migração SQL nova.**
- **SQL de limpeza** rodado uma vez via terminal da VPS.

## SQLs prontos pra copiar (após aprovar o plano)

```bash
# 1. Limpar órfãos
docker exec -i deploy-postgres-1 psql -U postgres -d postgres <<'SQL'
DELETE FROM group_participant_events e
WHERE NOT EXISTS (
  SELECT 1 FROM group_selected s
  WHERE s.workspace_id  = e.workspace_id
    AND s.instance_name = e.instance_name
    AND s.group_jid     = e.group_jid
);
SQL

# 2. Diagnóstico bruto vs dedup (hoje BRT)
docker exec -i deploy-postgres-1 psql -U postgres -d postgres <<'SQL'
WITH base AS (
  SELECT e.*
  FROM group_participant_events e
  JOIN group_selected s
    ON s.workspace_id  = e.workspace_id
   AND s.instance_name = e.instance_name
   AND s.group_jid     = e.group_jid
  WHERE e.created_at >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date) AT TIME ZONE 'America/Sao_Paulo'
    AND e.created_at <  (((now() AT TIME ZONE 'America/Sao_Paulo')::date) + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo'
)
SELECT
  'BRUTO' AS tipo, action, COUNT(*) AS total
FROM base GROUP BY action
UNION ALL
SELECT
  'DEDUP_MINUTO' AS tipo, action, COUNT(*) AS total
FROM (
  SELECT DISTINCT participant_jid, group_jid, action, date_trunc('minute', created_at)
  FROM base
) d GROUP BY action
ORDER BY tipo, action;
SQL
```

Aprove o plano e eu já aplico o patch no backend + te entrego os comandos finais pra rodar na VPS.

