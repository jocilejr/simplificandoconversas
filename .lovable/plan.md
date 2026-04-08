

# Corrigir log de erro e garantir funcionamento da criação de campanha

## Diagnóstico

As 5 tabelas existem na VPS. O schema está correto. O erro `undefined` indica que o objeto de erro retornado pelo Supabase client não tem `.message` — provavelmente é um objeto `{ code, details, hint, message }` onde `message` pode estar vazio, ou o PostgREST retorna erro em formato diferente.

## Correções

### 1. `deploy/backend/src/routes/groups-api.ts` — Melhorar logging de erro

No `POST /campaigns` (linha 166), trocar:
```ts
console.error("[groups-api] create campaign error:", err.message);
res.status(500).json({ error: err.message });
```
por:
```ts
console.error("[groups-api] create campaign error:", JSON.stringify(err, null, 2));
res.status(500).json({ error: err?.message || err?.details || err?.hint || JSON.stringify(err) });
```

Aplicar o mesmo padrão em todos os catches do arquivo que usam `err.message`.

### 2. `deploy/init-db.sql` — Adicionar as 5 tabelas de grupos

Garantir que próximos deploys criem as tabelas automaticamente. Adicionar ao final do arquivo:
- `group_selected`
- `group_campaigns`
- `group_scheduled_messages`
- `group_message_queue`
- `group_participant_events`

### 3. `deploy/migrate-workspace.sql` — Registrar tabelas nos arrays `_tables`

Adicionar as 5 tabelas em todos os arrays `_tables` do script para garantir:
- Coluna `workspace_id`
- Políticas RLS workspace-based
- Índices de workspace
- Backfill automático

### Instrução para VPS

Após o deploy do código atualizado:
1. `docker compose exec -T postgres psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"`
2. `docker compose restart postgrest`
3. `docker compose up -d --build backend`

## Arquivos alterados
1. `deploy/backend/src/routes/groups-api.ts`
2. `deploy/init-db.sql`
3. `deploy/migrate-workspace.sql`

