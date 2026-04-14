

## Fix: Dados existentes sem `cron_expression` + proteção contra flood

### Situação atual
- O **código** está correto — novas mensagens salvarão `cron_expression` e `next_run_at` corretamente
- Os **dados existentes** foram criados antes do fix, então têm `cron_expression = NULL`
- O UPDATE manual anterior setou todos para o mesmo minuto, causando o flood de 87 mensagens

### Solução em 2 partes

**Parte 1 — Reconstruir `cron_expression` dos dados existentes (VPS)**

O campo `content` já contém `time` e `weekdays`. Execute na VPS para verificar:

```bash
docker compose exec postgres psql -U postgres -d postgres --no-align -c "
SELECT id, schedule_type, 
  content->>'time' as time_val, 
  content->>'weekdays' as weekdays,
  content->>'monthDay' as month_day,
  content->>'customDays' as custom_days
FROM group_scheduled_messages 
WHERE is_active = true AND cron_expression IS NULL 
LIMIT 10;
"
```

Depois, um UPDATE dinâmico para reconstruir o cron e recalcular `next_run_at`:

```sql
-- Weekly: "MM HH * * dias"
UPDATE group_scheduled_messages SET
  cron_expression = CONCAT(
    SPLIT_PART(content->>'time', ':', 2), ' ',
    SPLIT_PART(content->>'time', ':', 1), ' * * ',
    REPLACE(REPLACE(REPLACE(content->>'weekdays', '[', ''), ']', ''), ' ', '')
  )
WHERE is_active = true AND cron_expression IS NULL 
  AND schedule_type = 'weekly' AND content->>'time' IS NOT NULL;

-- Daily: "MM HH * * *"  
UPDATE group_scheduled_messages SET
  cron_expression = CONCAT(
    SPLIT_PART(content->>'time', ':', 2), ' ',
    SPLIT_PART(content->>'time', ':', 1), ' * * *'
  )
WHERE is_active = true AND cron_expression IS NULL 
  AND schedule_type = 'daily' AND content->>'time' IS NOT NULL;
```

**Parte 2 — Recalcular `next_run_at` SEM flood**

Em vez de setar todos para `NOW()`, adicionar um endpoint temporário no backend ou um script que chame `computeNextRunAt()` para cada mensagem individualmente. Alternativa mais simples:

**Arquivo: `deploy/backend/src/index.ts`** — Adicionar um cron de "self-heal" que roda 1x ao iniciar: se encontrar mensagens ativas com `cron_expression` preenchida mas `next_run_at` NULL, calcula e seta o próximo horário correto usando `computeNextRunAt`.

**Arquivo: `deploy/backend/src/index.ts`** — Adicionar limite de segurança no scheduler principal: máximo 5 mensagens processadas por ciclo de 1 minuto, para evitar floods futuros.

### Passos para o usuário

1. Executar o SELECT de diagnóstico acima para confirmar que `content->>'time'` e `content->>'weekdays'` existem
2. Aprovar o plano para eu implementar as mudanças no código
3. Após deploy, os dados serão corrigidos automaticamente pelo self-heal

