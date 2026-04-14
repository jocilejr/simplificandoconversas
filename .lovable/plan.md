

# Correção: Mensagens agendadas desativadas permanentemente

## Problema raiz

Todas as mensagens de campanhas ativas estão com `is_active = false`. A cadeia de falhas:

1. Mensagens foram salvas sem `cron_expression` (campo NULL) — o frontend/API não está salvando essa informação corretamente
2. O self-heal tentou reconstruir, mas falhou porque o horário está em `content->>'runTime'` (camelCase) em vez de `content->>'time'`
3. Quando o scheduler as executou, `computeNextRunAfterExecution` recebeu `cron_expression = NULL` e `scheduledAt = NULL` → retornou `null` → mensagem desativada permanentemente

## Correções necessárias

### 1. `deploy/backend/src/routes/groups-api.ts` — `computeNextRunAfterExecution`

Quando `cronExpression` é NULL mas a mensagem tem `content` com informações de horário/dias, o sistema precisa reconstruir o cron antes de desistir. Adicionar um parâmetro opcional `content` à função para extrair horário e dias quando o cron está ausente.

Alternativa mais simples: garantir que o `cron_expression` SEMPRE seja salvo na criação/edição da mensagem (corrigir o fluxo de criação).

### 2. `deploy/backend/src/routes/groups-api.ts` — Rota de criação de mensagens

Verificar a rota `POST /campaigns/:id/messages` para garantir que `cron_expression` é calculado e salvo a partir dos dados do formulário (`time`, `weekdays`, `monthDay`, etc.) em **todos** os `schedule_type` (daily, weekly, monthly, custom).

### 3. `deploy/backend/src/index.ts` — Self-heal melhorado

O self-heal na inicialização precisa verificar tanto `content->>'time'` quanto `content->>'runTime'` para reconstruir o cron. Atualmente só verifica `time`.

### 4. `deploy/backend/src/index.ts` — Scheduler resiliente

No loop do scheduler (linha 293), antes de chamar `computeNextRunAfterExecution`, se `cron_expression` for NULL, tentar reconstruir a partir de `msg.content` (que já está no select). Isso evita desativar mensagens recorrentes por falta de cron.

### 5. Limpeza imediata na VPS

Após o deploy, reativar e reconstruir as mensagens das campanhas ativas:

```bash
docker compose exec postgres psql -U postgres -d postgres --pset=pager=off -c "
UPDATE group_scheduled_messages
SET is_active = true,
    next_run_at = NOW() + interval '1 minute'
WHERE campaign_id IN (SELECT id FROM group_campaigns WHERE is_active = true)
  AND schedule_type != 'once'
  AND is_active = false;"
```

Depois, reiniciar o backend para que o self-heal reconstrua os crons:
```bash
docker compose restart backend
```

## Resumo das mudanças em código

| Arquivo | Mudança |
|---------|---------|
| `groups-api.ts` — rota POST messages | Sempre calcular e salvar `cron_expression` |
| `groups-api.ts` — rota PUT messages | Recalcular `cron_expression` ao editar horário/dias |
| `groups-api.ts` — `computeNextRunAfterExecution` | Aceitar `content` como fallback quando cron é NULL |
| `index.ts` — self-heal | Verificar `runTime` além de `time` |
| `index.ts` — scheduler loop | Reconstruir cron inline antes de desativar |

## Resultado esperado

- Mensagens recorrentes nunca serão desativadas por falta de cron
- Toda mensagem criada/editada terá `cron_expression` preenchido
- Self-heal funciona com ambos os formatos de conteúdo (`time`/`runTime`)

