
# ✅ Implementado: Scheduler modelo whats-grupos

## Mudanças realizadas

### `deploy/backend/src/routes/groups-api.ts`
- **Removido**: `parseCronTime`, `buildCronFromContent`, `computeNextRunAt`, `computeNextRunAfterExecution`
- **Adicionado**: `calculateNextRunAt(msg)` — calcula próximo horário direto do `content` (runTime/weekDays/monthDay/customDays) com conversão BRT→UTC
- **Adicionado**: `calculateFirstRunAt(msg)` — para criação/edição, verifica se hoje ainda é válido antes de pular para o próximo dia
- **Simplificado**: Rotas POST/PUT/toggle não usam mais `cron_expression`

### `deploy/backend/src/index.ts`
- **Scheduler**: Janela de 60 segundos ("now or never"), sem backlog
- **Self-heal**: Simplificado, usa `calculateNextRunAt` direto do content
- **Removido**: Referências a `buildCronFromContent`/`computeNextRunAfterExecution`

## Limpeza na VPS após deploy

```bash
# 1. Cancelar fila pendente acumulada
docker compose exec postgres psql -U postgres -d postgres -c "
UPDATE group_message_queue SET status = 'cancelled', error_message = 'Cleanup: reset'
WHERE status = 'pending';"

# 2. Reativar mensagens recorrentes e forçar recálculo
docker compose exec postgres psql -U postgres -d postgres -c "
UPDATE group_scheduled_messages 
SET is_active = true, next_run_at = NOW() + interval '1 minute'
WHERE campaign_id IN (SELECT id FROM group_campaigns WHERE is_active = true)
  AND schedule_type != 'once'
  AND is_active = false;"

# 3. Restart para self-heal
docker compose restart backend
```
