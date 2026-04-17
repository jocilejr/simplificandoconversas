

## Princípio aceito

Front é **dumb client**. Apenas exibe o que `/api/groups/events-summary` e `/api/groups/events` retornam. Zero lógica de filtragem, dedup, agregação ou normalização no front.

## Estado atual (auditoria rápida)

**`useGroupEvents.ts`** já chama os endpoints VPS via `fetchVPS()` quando NÃO está em preview Lovable. Mas tem 3 violações desse princípio:

1. **Fallback Supabase direto** (`fetchSupabaseFallback`) — refaz toda a query no client, com filtro `allowed.has()`, paginação manual e `buildEventCounts`/`buildGroupCounts` rodando no JS. Vira fonte alternativa de números diferentes.
2. **Cálculo de `start`/`end` em BRT no front** — o front decide a janela e manda pro backend. Se o front errar o fuso, o backend obedece. O backend deveria receber só `period=today|yesterday|custom&from=&to=` e calcular a janela.
3. **`buildGroupCounts` ainda roda no front** se o backend não retornar `groupCounts` — fallback silencioso que pode mascarar bugs.

## Plano (front vira dumb client)

### 1. `useGroupEvents.ts` — remover toda lógica
- **Remover** `fetchSupabaseFallback`, `buildEventCounts`, `buildGroupCounts`, `getDateRange`, `toBrazilUtcRange`, `VALID_ACTIONS`, `EVENTS_PAGE_SIZE`.
- **Remover** o flag `isLovablePreview` — o app só roda na VPS, fallback Supabase é código morto que confunde.
- Hook fica com **uma única chamada**: `GET /api/groups/events-summary?workspaceId=X&period=today` (sem cálculo de start/end no front).
- Usar exatamente `eventCounts` e `groupCounts` retornados, sem nenhum recálculo.

### 2. `groups-api.ts` — backend assume responsabilidade total da janela
- Endpoint passa a aceitar `period=today|yesterday|custom` + `from`/`to` opcionais (só usados se `period=custom`).
- Cálculo de "hoje BRT" (`((now() AT TIME ZONE 'America/Sao_Paulo')::date) AT TIME ZONE 'America/Sao_Paulo'`) feito **no SQL**, igual ao diagnóstico que já validou 88/74.
- Mesma lógica em `/events` (lista).
- Manter dedup por minuto que já existe.
- Garantir que `groupCounts` sempre venha preenchido pra todo `group_jid` em `group_selected` (mesmo zerado), pra UI não precisar inventar default.

### 3. Validação pós-deploy
Após deploy, o front deve mostrar **exatamente 88/74** (= o que o banco tem hoje). Se mostrar, o problema #1 (front ≠ banco) está fechado.

Aí atacamos o #2 (banco 88/74 vs real 113/57) numa próxima iteração, com logging de descarte no `groups-webhook.ts`.

## Arquivos a alterar

- `src/hooks/useGroupEvents.ts` — reescrita completa (vira ~40 linhas)
- `deploy/backend/src/routes/groups-api.ts` — `/events-summary` e `/events` passam a calcular janela via SQL com `period`

Sem schema. Sem migração. Sem mudança de UI (`GroupDashboardTab` continua consumindo `eventCounts`/`groupCounts` igual).

