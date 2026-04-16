

# Plano: Corrigir jobs "processing" travados no Follow Up

## Problema
Os 9 jobs marcados como `processing` ficaram travados infinitamente. O código de recuperação de jobs "stale" (linha 721-733) só roda quando `/process` é chamado novamente. O endpoint `/status` (que o frontend consulta a cada 10s) apenas lê os dados — nunca limpa jobs travados. Resultado: o banner "Em progresso" fica infinito.

## Causa raiz
O dispatch usa fire-and-forget (`queue.enqueue`). Se o servidor reiniciar ou a fila perder o job, o status fica preso em `processing` para sempre. A limpeza automática de 15 minutos só é invocada dentro de `processQueueForWorkspace`, que só roda no próximo `/process`.

## Correção

### 1. Adicionar recuperação de jobs stale no `/status`
**Arquivo:** `deploy/backend/src/routes/followup-daily.ts` — endpoint `GET /status` (~linha 1026)

Antes de contar os jobs, executar a mesma lógica de recuperação:

```typescript
// Reset stale processing jobs (>15 min without update)
const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
await sb
  .from(FOLLOWUP_QUEUE_TABLE)
  .update({
    status: "failed",
    last_error: "Job travado — tempo limite de processamento excedido",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq("workspace_id", workspaceId)
  .eq("dispatch_date", today)
  .eq("status", "processing")
  .lte("updated_at", staleCutoff);
```

Diferença do existente: em vez de recolocar como `pending` (que pode criar loop), marca como `failed` com mensagem clara. Assim o usuário vê "2 falhas" e pode retentar manualmente.

### 2. Ajustar o banner do frontend para mostrar estado mais claro
**Arquivo:** `src/components/followup/FollowUpDashboard.tsx`

No banner de status (~linha 256), quando `processing > 0` mas `pending === 0`, verificar se todos os jobs de processing são antigos (>5 min). Se sim, mostrar "Verificando jobs travados..." em vez de "Em progresso".

Na prática, como o backend já vai limpar os stale no `/status`, o frontend vai receber `processing: 0` e `failed: N` naturalmente após a primeira chamada. Então o ajuste principal é no backend.

## Deploy na VPS
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

## Para liberar os 9 jobs travados imediatamente (antes do deploy)
```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
UPDATE followup_dispatch_queue 
SET status = 'failed', 
    last_error = 'Job travado manualmente liberado', 
    completed_at = now(), 
    updated_at = now() 
WHERE status = 'processing' 
  AND updated_at < now() - interval '5 minutes';
"
```

