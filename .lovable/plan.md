

## Fix: Scheduler de Grupos — `next_run_at` sempre NULL

### Causa raiz confirmada

Todos os 10 registros ativos têm `next_run_at` e `scheduled_at` **vazios (NULL)**. O scheduler faz `.lte("next_run_at", now)` — como é NULL, nunca retorna nada.

O problema está no fluxo de criação:

1. Para tipos `weekly`, `daily`, `monthly` e `custom`, o frontend envia `scheduledAt: null` (só preenche `cronExpression`)
2. O backend chama `computeNextRunAt("weekly", null, ...)` que retorna `null` porque a primeira coisa que faz é `if (!scheduledAt) return null`
3. Resultado: `next_run_at` é gravado como NULL no banco

### Solução

**Arquivo 1: `deploy/backend/src/routes/groups-api.ts`** — Refatorar `computeNextRunAt` para usar `cronExpression` quando `scheduledAt` é null:

- Para `daily`: parsear o cron `{min} {hora} * * *` e calcular o próximo horário hoje/amanhã
- Para `weekly`: parsear o cron `{min} {hora} * * {dias}` e calcular o próximo dia da semana
- Para `monthly`: parsear o cron `{min} {hora} {dia} * *` e calcular o próximo dia do mês
- Para `custom`: mesmo tratamento do monthly

Mesma lógica para `computeNextRunAfterExecution`.

**Arquivo 2: `deploy/backend/src/index.ts`** — Adicionar log de erro explícito no catch do scheduler (linha ~260) para que erros não sejam silenciosos.

### Correção dos dados existentes (VPS)

Após o deploy, executar na VPS para popular `next_run_at` dos registros existentes:

```bash
docker compose exec postgres psql -U postgres -d postgres -c "
UPDATE group_scheduled_messages 
SET next_run_at = NOW() + INTERVAL '1 minute'
WHERE is_active = true AND next_run_at IS NULL;
"
```

Isso força o scheduler a processar todos na próxima execução do cron e recalcular `next_run_at` corretamente após a execução.

### Detalhes técnicos da refatoração

```typescript
// computeNextRunAt — daily com cron fallback
case "daily": {
  if (scheduledAt) {
    // lógica existente
  } else if (cronExpression) {
    // Parsear "MM HH * * *"
    const [min, hour] = cronExpression.split(" ");
    const next = new Date(now);
    next.setHours(+hour, +min, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  return null;
}

// computeNextRunAt — weekly com cron fallback  
case "weekly": {
  if (scheduledAt) {
    // lógica existente
  } else if (cronExpression) {
    // Parsear "MM HH * * 1,2,3,4,5"
    const parts = cronExpression.split(" ");
    const [min, hour] = [+parts[0], +parts[1]];
    const days = parts[4].split(",").map(Number);
    // Encontrar próximo dia válido
    for (let i = 0; i < 8; i++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + i);
      candidate.setHours(hour, min, 0, 0);
      if (days.includes(candidate.getDay()) && candidate > now) {
        return candidate.toISOString();
      }
    }
  }
  return null;
}
```

Mesma abordagem para `monthly`, `custom` e para `computeNextRunAfterExecution`.

### Resultado esperado
- Mensagens agendadas terão `next_run_at` calculado corretamente
- O cron de 1 minuto vai encontrar mensagens e enfileirar na `group_message_queue`
- Após execução, `next_run_at` é recalculado para a próxima ocorrência

