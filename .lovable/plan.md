# Reescrever o Scheduler seguindo o modelo do whats-grupos

## Análise do projeto de referência

O projeto `whats-grupos` usa uma abordagem muito mais simples:

1. **Sem cron_expression** — calcula `next_run_at` diretamente a partir de `content.runTime`, `content.weekDays`, `content.monthDay`, `content.customDays`
2. **Função `claim_due_messages**` (RPC no Postgres) — faz SELECT + UPDATE atômico para "travar" mensagens vencidas e evitar race conditions
3. `**calculateNextRunAt**` — função pura que recebe a mensagem e calcula o próximo horário usando conversão BRT→UTC simples
4. **Dedup por janela de 2 horas** — verifica se o `group_id` + `scheduled_message_id` já tem item `pending/sending/sent` criado nas últimas 2 horas
5. **Sem flood protection** — processa todas as mensagens vencidas de uma vez

## O que vamos mudar

### 1. `deploy/backend/src/routes/groups-api.ts`

**Substituir** `computeNextRunAt`, `computeNextRunAfterExecution`, `buildCronFromContent` e `parseCronTime` por uma **única função** `calculateNextRunAt(msg, now)` seguindo o modelo do whats-grupos:

```text
function calculateNextRunAt(msg, now):
  extrair runTime do content (content.runTime || content.time || "08:00")
  converter para componentes BRT (now - 3h)
  
  daily  → próximo dia, mesmo horário BRT
  weekly → próximo dia da semana em content.weekDays
  monthly → próximo mês no content.monthDay  
  custom → próximos content.customDays no mês atual/próximo
  once   → null (desativar)
```

- Usar conversão BRT→UTC igual ao referência (`brtToUtc`)
- Não depender de `cron_expression` nem de `scheduledAt` — tudo vem do `content`

**Remover** campos/lógica de `cron_expression` da criação e edição de mensagens (simplificar as rotas POST/PUT).

### 2. `deploy/backend/src/index.ts` — Scheduler Cron

**Simplificar** o cron do scheduler:

- Buscar mensagens com `is_active = true` e `next_run_at <= now` e `next_run_at >= now - 60s` (manter janela "now or never")
- Para cada mensagem:
  - Buscar campanha. Se inativa/inexistente → desativar mensagem
  - Dedup: verificar na `group_message_queue` se já existe item `pending/processing/sent` para o mesmo `scheduled_message_id` + `group_jid` nos últimos 5 minutos
  - Inserir itens na fila
  - Se `schedule_type === "once"` → desativar
  - Senão → calcular `next_run_at` com a nova `calculateNextRunAt(msg, now)` e salvar

**Remover**:

- Self-heal de cron_expression (não é mais necessário)
- Referências a `buildCronFromContent` no scheduler
- Flood protection (já removido)

### 3. Limpeza na VPS após deploy

```bash
# Reativar mensagens recorrentes de campanhas ativas e forçar recálculo
docker compose exec postgres psql -U postgres -d postgres -c "
UPDATE group_scheduled_messages 
SET is_active = true, next_run_at = NOW() + interval '1 minute'
WHERE campaign_id IN (SELECT id FROM group_campaigns WHERE is_active = true)
  AND schedule_type != 'once'
  AND is_active = false;"

docker compose restart backend
```

## Resultado esperado

- Lógica idêntica ao whats-grupos que já funciona em produção
- Sem dependência de `cron_expression` — tudo calculado a partir do `content`
- Conversão de timezone BRT correta
- Scheduler simples e previsível