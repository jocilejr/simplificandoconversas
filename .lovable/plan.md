

# Plano: Eliminar `is_active` das mensagens — campanha é a única fonte de verdade

## Contexto
Mensagens (`group_scheduled_messages`) ainda possuem `is_active` em vários pontos do código. Isso causa o bug onde todas as 185 mensagens estão com `is_active=false` e mesmo ativando a campanha nada funciona. A coluna continuará existindo na tabela (para não quebrar o schema), mas será completamente ignorada no código.

## Alterações

### 1. `deploy/backend/src/routes/groups-api.ts`

**Inserção de mensagem (linha 1040):** Remover `is_active: true` do insert (ou manter como default, tanto faz — será ignorado).

**Import de backup (linha 1993):** Trocar `is_active: msg.is_active ?? true` por `is_active: true` (hardcode, nunca false).

**scheduler-debug endpoint (linhas 2300-2319):**
- Remover `is_active` do select (linha 2300)
- Remover filtro `m.is_active` (linhas 2312, 2317) — usar apenas filtro de campanha ativa (linhas 2336-2342)
- Remover `is_active: m.is_active` do response (linha 2408)
- Passar `isActive: true` hardcoded para `resolveSchedulerStatus` (linha 2389)

**`resolveSchedulerStatus` (linhas 396-541):**
- Remover parâmetro `isActive` da interface
- Remover bloco que checa `!isActive` (linhas 532-541) — "publicação desativada"
- Remover referências a `isActive` nos stale diagnostic checks (linhas 471-473, 511)
- Remover `"message_inactive"` e `"message_inactive_at_dispatch"` dos stale codes (linha 470)

**enqueue endpoint (linha 964-966):** Já está correto (sem filtro de is_active na mensagem).

### 2. `deploy/backend/src/lib/group-scheduler.ts`

Já foi limpo na rodada anterior. Verificar que não resta nenhuma referência a `msg.is_active` (confirmado: não há).

### 3. `src/hooks/useSchedulerDebug.ts`

- Remover `is_active: boolean` do type `ScheduledMessageDebug` (linha 34)

### 4. `src/hooks/useGroupScheduledMessages.ts`

- Já limpo (toggleMessage removido na rodada anterior). Sem alteração.

### 5. SQL — Corrigir dados legados

Executar na VPS para corrigir as 185 mensagens com `is_active=false`:
```sql
UPDATE group_scheduled_messages SET is_active = true WHERE is_active = false;
```

## Resultado
- `is_active` nas mensagens é completamente ignorado em todo o código
- Ativar campanha = scheduler busca TODAS as mensagens e cria timers
- Visão geral mostra TODAS as publicações de campanhas ativas
- Dados legados corrigidos com UPDATE simples

## Validação
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

Corrigir dados:
```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "UPDATE group_scheduled_messages SET is_active = true WHERE is_active = false;"
```

Verificar:
```bash
docker logs deploy-backend-1 --since=2m 2>&1 | grep -i "\[groups-api\]\|\[scheduler\]" | tail -30
```

