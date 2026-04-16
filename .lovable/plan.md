

# Plano: Corrigir fonte de dados dos eventos de grupo

## Problema raiz

O `useGroupEvents.ts` consulta os eventos via **Supabase client** (`supabase.from("group_participant_events")`), que aponta para o banco do **Lovable Cloud**. Mas os dados reais estão no banco da **VPS** (`deploy-postgres-1`). Por isso os números nunca batem — o frontend está lendo de um banco vazio/diferente.

Outros hooks como `useGroupSelected` já resolvem isso corretamente: detectam se estão na VPS e usam `apiUrl()` + `fetch` para consultar o backend da VPS.

## Solução

### 1. Criar endpoint no backend VPS: `GET /api/groups/events`

Em `deploy/backend/src/routes/groups-api.ts`, adicionar uma rota que aceita:
- `workspaceId` (obrigatório)
- `groupJids` (lista separada por vírgula)
- `start` e `end` (ISO strings para filtrar período)

A rota consulta `group_participant_events` no banco local e retorna todos os eventos do período, sem limite artificial.

### 2. Refatorar `src/hooks/useGroupEvents.ts`

Substituir a consulta direta ao Supabase por uma chamada via `apiUrl("groups/events")` + `fetch`, similar ao padrão do `useGroupSelected`. Manter fallback para Supabase client quando em preview do Lovable.

A lógica de `buildEventCounts` e `buildGroupCounts` continua no frontend (são apenas contadores simples sobre o array retornado).

### 3. Nenhuma mudança no dashboard

O `GroupDashboardTab.tsx` já consome `eventCounts` e `groupCounts` do hook — não precisa mudar.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/groups-api.ts` | Nova rota `GET /events` |
| `src/hooks/useGroupEvents.ts` | Usar `apiUrl` + `fetch` em vez de `supabase.from()` |

## Comando VPS após deploy

```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

## Resultado esperado

Os números no dashboard vão bater exatamente com a query SQL do banco da VPS.

