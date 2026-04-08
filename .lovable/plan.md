

# Implementar a lógica de pausa (cooldown) na fila de mensagens

## Problema
A `MessageQueue` só implementa delay entre mensagens (`delayMs`). As colunas `pause_after_sends` e `pause_minutes` existem na tabela `message_queue_config` e são configuráveis na UI, mas o backend **nunca lê nem aplica** essas regras. Resultado: a fila não respeita o cooldown configurado.

## Solução

### 1. `deploy/backend/src/lib/message-queue.ts` — Adicionar cooldown à classe

Adicionar ao `MessageQueue`:
- `pauseAfterSends: number | null` — após N envios, pausar
- `pauseMinutes: number | null` — pausar por M minutos
- `sendCount: number` — contador de envios desde último cooldown

Na `processNext()`:
```text
1. Enviar mensagem
2. Incrementar sendCount
3. Se pauseAfterSends > 0 E sendCount >= pauseAfterSends:
   → Esperar pauseMinutes * 60 * 1000 ms
   → Resetar sendCount = 0
4. Senão: esperar delayMs normal
```

Atualizar `getMessageQueue()` para aceitar e propagar `pauseAfterSends` e `pauseMinutes`.

Adicionar método `setCooldown(pauseAfterSends, pauseMinutes)` similar ao `setDelay()`.

### 2. `deploy/backend/src/lib/recovery-dispatch.ts` — Ler cooldown do banco

No passo 8 (onde já lê `delay_seconds`), também ler `pause_after_sends` e `pause_minutes`:

```text
const { data: queueConfig } = await sb
  .from("message_queue_config")
  .select("delay_seconds, pause_after_sends, pause_minutes")
  .eq("workspace_id", opts.workspaceId)
  .eq("instance_name", instanceName)
  .maybeSingle();
```

Passar esses valores ao `getMessageQueue()`.

### 3. `deploy/backend/src/routes/execute-flow.ts` — Ler cooldown para fluxos

Na inicialização da queue (linha ~260), também ler `pause_after_sends` e `pause_minutes` do `message_queue_config` e passar ao `getMessageQueue()`.

## Arquivos alterados
1. **`deploy/backend/src/lib/message-queue.ts`** — cooldown logic na classe + API atualizada
2. **`deploy/backend/src/lib/recovery-dispatch.ts`** — ler e passar cooldown params
3. **`deploy/backend/src/routes/execute-flow.ts`** — ler e passar cooldown params

## Deploy
```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

