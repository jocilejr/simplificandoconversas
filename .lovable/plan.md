

# Correção: Simplificar scheduler para lógica "agora ou nunca"

## Problema

Dois bugs críticos:

1. **Dedup no processador da fila (groups-api.ts linha 928-943)**: Verifica se já existe QUALQUER registro `sent` com o mesmo `scheduled_message_id` + `group_jid` — sem janela de tempo. Ou seja, depois que uma mensagem recorrente é enviada uma vez, todas as próximas execuções são canceladas como "Dedup: já enviada".

2. **Scheduler busca backlog**: A query `lte("next_run_at", now)` pega TODAS as mensagens atrasadas. Se alguma coisa ficou com `next_run_at` no passado, ela volta toda vez.

## Correções

### 1. `deploy/backend/src/routes/groups-api.ts` — Dedup no processador

Linha 928-943: A dedup precisa ter uma **janela de tempo curta** (5 minutos) para só evitar duplicatas do mesmo ciclo, não bloquear execuções futuras.

```typescript
// ANTES (quebrado):
.eq("status", "sent")
.neq("id", item.id);

// DEPOIS (correto):
.eq("status", "sent")
.neq("id", item.id)
.gte("created_at", new Date(Date.now() - 5 * 60000).toISOString());
```

### 2. `deploy/backend/src/index.ts` — Scheduler simples

Substituir a query do scheduler para buscar apenas mensagens com `next_run_at` dentro do minuto atual (janela de 90 segundos para cobrir delay), em vez de pegar todo o backlog:

```typescript
// ANTES:
.lte("next_run_at", now)

// DEPOIS — janela de 90 segundos:
const windowStart = new Date(Date.now() - 90 * 1000).toISOString();
const now = new Date().toISOString();
// Buscar mensagens com next_run_at entre agora-90s e agora
.lte("next_run_at", now)
.gte("next_run_at", windowStart)
```

Isso garante que mensagens com `next_run_at` muito no passado (backlog) são ignoradas. Apenas as que caem na janela do minuto atual são processadas.

### 3. `deploy/backend/src/index.ts` — Remover flood protection

O limite de 5 mensagens por ciclo não faz mais sentido com a janela de tempo. Remover o `splice(5)` — se 30 mensagens estão programadas para 11:30, todas devem ir para a fila.

### 4. Limpeza na VPS após deploy

```bash
# Limpar fila pendente acumulada
docker compose exec postgres psql -U postgres -d postgres -c "
UPDATE group_message_queue SET status = 'cancelled', error_message = 'Cleanup: reset'
WHERE status = 'pending';"

# Recalcular next_run_at para todas as mensagens ativas
docker compose restart backend
```

## Resultado

- Scheduler busca apenas mensagens do minuto atual
- Dedup não bloqueia mensagens recorrentes
- Sem acúmulo de backlog
- A fila processa normalmente

