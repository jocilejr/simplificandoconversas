

# Sistema Anti-Spam + Agendamento Automático de Grupos

## Problemas atuais
1. `next_run_at` nunca é preenchido na criação de mensagens agendadas
2. Não existe cron que verifique `next_run_at` e enfileire automaticamente
3. Processamento da fila é manual (botão) e sem rate limiting
4. Sem proteção anti-spam por grupo

## Solução

### 1. Migration: tabela `group_queue_config`
Configuração anti-spam por workspace:
- `max_messages_per_group` (default 3) — max mensagens por grupo na janela
- `per_minutes` (default 60) — janela de tempo em minutos
- `delay_between_sends_ms` (default 3000) — delay entre envios

### 2. Backend: Calcular `next_run_at` ao criar/atualizar mensagem
**Arquivo:** `deploy/backend/src/routes/groups-api.ts`

No POST e PUT de mensagens, calcular `next_run_at` baseado no `schedule_type`:
- `once`: `next_run_at = scheduled_at`
- `daily`: próximo horário do dia (hoje ou amanhã)
- `weekly`: próximo dia da semana configurado
- `monthly`: próximo dia do mês configurado
- `custom`: próximo dia do mês na lista

### 3. Backend: Cron global (1/min) — Scheduler
**Arquivo:** `deploy/backend/src/index.ts`

Novo cron a cada minuto que:
1. Busca `group_scheduled_messages` onde `is_active = true` AND `next_run_at <= now()`
2. Busca a campanha associada para obter `group_jids` e `instance_name`
3. Insere itens na `group_message_queue` com status `pending`
4. Atualiza `last_run_at` e calcula próximo `next_run_at`
5. Para `once`, desativa após enfileirar (`is_active = false`)

### 4. Backend: Cron global (30s) — Processador com rate limiting
**Arquivo:** `deploy/backend/src/index.ts`

Novo cron a cada 30s que:
1. Busca itens `pending` da fila ordenados por prioridade/criação
2. Para cada item, conta quantas mensagens foram enviadas (`status = sent`) para aquele `group_jid` nos últimos `per_minutes` minutos
3. Se atingiu `max_messages_per_group` → pula (mantém pending)
4. Se dentro do limite → envia com delay entre mensagens
5. Usa a mesma lógica de envio existente (sendText/sendMedia)

### 5. Backend: Endpoints de configuração anti-spam
**Arquivo:** `deploy/backend/src/routes/groups-api.ts`

- `GET /groups/spam-config?workspaceId=X`
- `PUT /groups/spam-config` — atualiza limites

### 6. Frontend: UI de configuração anti-spam
**Arquivo:** `src/components/grupos/GroupQueueTab.tsx`

Adicionar card de configuração com inputs editáveis para os 3 parâmetros. Remover botão "Processar" manual (agora é automático).

### 7. Frontend: Hook para spam config
**Arquivo:** `src/hooks/useGroupQueue.ts`

Adicionar queries/mutations para buscar e salvar configuração anti-spam.

## Fluxo completo
```text
Usuário agenda mensagem (schedule_type + horário)
    │
    ▼  next_run_at é calculado automaticamente
group_scheduled_messages (next_run_at = "2026-04-09T09:00:00Z")
    │
    ▼  [cron 60s: scheduler verifica next_run_at <= now()]
group_message_queue (status: pending, um item por grupo-alvo)
    │
    ▼  [cron 30s: processor]
    ├─ Conta envios recentes para o grupo
    ├─ Limite OK? → Envia → status: sent
    └─ Excedeu? → Pula (tenta no próximo ciclo)
```

## Arquivos alterados
1. **Migration SQL** — criar `group_queue_config`
2. `deploy/backend/src/routes/groups-api.ts` — calcular `next_run_at`, endpoints spam-config
3. `deploy/backend/src/index.ts` — 2 novos crons (scheduler + processor)
4. `src/hooks/useGroupQueue.ts` — adicionar spam config
5. `src/components/grupos/GroupQueueTab.tsx` — UI anti-spam, remover botão manual

