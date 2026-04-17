

## Diagnóstico definitivo

Cruzando as 3 fontes:

| Fonte | add | remove |
|---|---|---|
| Banco bruto (A) | 88 | 74 |
| Banco com JOIN estrito (B) | 88 | 74 |
| Banco com dedup por minuto (D) | 88 | 74 |
| **Backend `/events-summary`** | **69** | **35** |

`totalRows: 104` e `rawRows: 104` no JSON do backend confirma: **o backend só recebeu 104 linhas do banco**, mas o banco tem **88+74=162** linhas hoje. Faltam **58 linhas** entre o banco e o backend.

E ainda: das 104 que o backend recebeu, depois da dedup sobram 69+35=104 (não há colapso). Logo, o problema **não é dedup**. O problema é a **query do Supabase JS** no `/events-summary` está limitando a 1000 e/ou paginando errado e/ou aplicando algum filtro extra que descarta 58 eventos.

Olhando `groupCounts` no JSON: a soma dos `remove` por grupo dá 35 (bate com `eventCounts.remove=35`). Os grupos com mais `remove` no banco (que somam 74) estão aparecendo com contagem reduzida. Ex: vários grupos com 0 remove no JSON podem ter remove no banco.

## Hipótese forte

O `groups-api.ts /events-summary` faz a query do Supabase JS com filtro `.in("group_jid", groupJids)`. Se houver **mais de ~100 group_jids selecionados**, o `.in()` pode estar quebrando silenciosamente (URL muito longa → PostgREST trunca / retorna parcial). Isso explicaria por que vem 104 de 162 sem erro.

Alternativa: a query usa `.range()` ou `.limit(1000)` mas há algum filtro `.eq("action", ...)` que está cortando.

## Plano (1 leitura + 1 patch)

### Passo 1 — Ler o código atual de `/events-summary` no backend

Preciso confirmar exatamente:
- Quantos `group_jids` ele passa no `.in()`
- Se tem `.limit()` ou `.range()`
- Quais filtros aplica
- Como faz a paginação

### Passo 2 — Aplicar SQL diagnóstico complementar (paralelo)

Pra confirmar a hipótese das 58 linhas perdidas:

```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres <<'SQL'
\set ws '65698ec3-731a-436e-84cf-8997e4ed9b41'

\echo '--- E) Quantos grupos selecionados ---'
SELECT COUNT(DISTINCT group_jid) FROM group_selected WHERE workspace_id=:'ws';

\echo '--- F) Tamanho da lista de group_jids (caracteres) ---'
SELECT length(string_agg(DISTINCT group_jid, ',')) AS chars_da_url
FROM group_selected WHERE workspace_id=:'ws';

\echo '--- G) Comparar contagem por grupo: banco vs backend ---'
SELECT e.group_jid, e.action, COUNT(*) AS banco
FROM group_participant_events e
WHERE e.workspace_id = :'ws'
  AND e.created_at >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date) AT TIME ZONE 'America/Sao_Paulo'
  AND e.created_at <  (((now() AT TIME ZONE 'America/Sao_Paulo')::date)+INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo'
GROUP BY e.group_jid, e.action
ORDER BY e.group_jid, e.action;
SQL
```

Comparando G com o `groupCounts` do JSON do backend, identifico exatamente quais grupos perderam eventos.

### Passo 3 — Patch (após ver o código)

Substituir a query do Supabase JS por **SQL bruto via `pg`** ou por uma RPC, fazendo o JOIN+dedup+count tudo no banco numa única query. Front continua dumb client. Backend para de tentar carregar linhas pra fazer agregação no JS — delega tudo pro Postgres, que já provou (D) ter os números certos.

## Comandos pra você rodar agora

Rode o bloco SQL acima (E/F/G) e me cola a saída. Em paralelo eu leio `deploy/backend/src/routes/groups-api.ts` pra ver a implementação atual e mando o patch único na próxima iteração.

