

# Plano: Remover `is_active` das publicações — ativação apenas por campanha

## Conceito

Publicações (`group_scheduled_messages`) não terão mais estado `is_active` próprio. Se a campanha está ativa, **todas** as suas publicações estão ativas. Se está inativa, nenhuma está. A coluna `is_active` na tabela continuará existindo (para não quebrar queries existentes), mas será sempre `true` — ignorada na lógica.

## Alterações

### 1. Backend — `deploy/backend/src/routes/groups-api.ts`

**PUT /campaigns/:id (sync ao ativar):**
- Remover `.eq("is_active", true)` da query de mensagens — buscar **todas** as mensagens da campanha
- Quando campanha ativa: agendar todas as mensagens (recalcular `next_run_at` se expirado; `once` expirado = pular)
- Quando campanha inativa: cancelar todos os timers

**POST /campaigns/:id/messages (criar mensagem):**
- Manter `is_active: true` no insert (sempre true)
- Verificar se a campanha pai está ativa; se sim, registrar timer imediatamente

**PUT /campaigns/:id/messages/:msgId (editar mensagem):**
- Não mexer em `is_active`
- Se campanha ativa, re-registrar timer com novo horário

**DELETE rota de toggle:** Remover completamente o endpoint `PATCH /campaigns/:id/messages/:msgId/toggle`

**POST /campaigns/:id/send-now (envio imediato):**
- Remover o `if (!msg.is_active) continue` (linha 966) — todas as mensagens participam

### 2. Backend — `deploy/backend/src/lib/group-scheduler.ts`

**`loadAll()`:**
- Remover `.eq("is_active", true)` da query de mensagens — buscar todas
- Manter apenas o filtro por campanha ativa (já existe)
- Remover lógica de `is_active: false` no deactivate de `once` expirado (apenas pular, sem marcar)

**`scheduleMessage()`:**
- Remover o check `if (!msg.is_active)` que retorna "Inativa"
- Remover `is_active` do tipo do parâmetro

**`fireMessage()`:**
- Remover `if (!msg.is_active)` check — substituir por check de campanha ativa (já existe)
- Após `once` disparar, marcar `next_run_at = null` sem tocar `is_active`
- Quando não conseguir calcular próximo run de recorrente, marcar `next_run_at = null` sem `is_active = false`

**`selfHeal()`:**
- Remover `.eq("is_active", true)` — buscar todas e filtrar por campanha ativa

### 3. Frontend — `src/hooks/useGroupScheduledMessages.ts`

- Remover o `toggleMessage` mutation completamente
- Remover do return

### 4. Frontend — `src/components/grupos/GroupMessagesDialog.tsx`

- Remover qualquer referência a toggle de mensagem individual (se existir na UI)
- As publicações são listadas sem switch de ativação

### 5. Frontend — `src/components/grupos/SchedulerDebugPanel.tsx` (se aplicável)

- Remover referências a "publicação inativa" nos diagnósticos

## Resultado
- Ativar campanha = todas as publicações recebem timers
- Desativar campanha = todos os timers cancelados
- Sem estado fantasma de `is_active = false` em publicações
- Código mais simples e previsível

