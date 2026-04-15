

## Plano — Fix: Follow Up fire-and-forget + remover lock

### Problema raiz
1. **`await queue.enqueue()`** (linha 852) bloqueia até o envio real na fila anti-ban (30s+ delay por mensagem). Com 40 jobs = 20+ minutos bloqueado. O HTTP dá timeout.
2. **`workspaceLocks`** (linha 924-929) impede re-execuções. Se o timeout mata a request, o lock fica preso em memória indefinidamente.
3. Jobs ficam travados em `processing` — nunca chegam a `sent` ou `failed`.
4. O frontend mostra "concluído" porque o POST retornou (com timeout ou 0 enviados), mas a table mostra `pending`/`processing`.

### Correções em `deploy/backend/src/routes/followup-daily.ts`

**1. Remover `workspaceLocks` (linhas 7, 924-929, 947-948)**
Desnecessário: a geração é idempotente (upsert com unique constraint) e o claim usa `eq("status", currentStatus)`.

**2. Fire-and-forget no envio (linhas 851-898)**
Trocar `await queue.enqueue()` por enfileiramento sem bloqueio com callbacks:

```typescript
queue.enqueue(async () => {
  await dispatchJob({ ...job, normalized_phone: normalizedPhone }, context.delayMs);
}, `followup:${job.transaction_id}:${job.rule_id}`)
  .then(async () => {
    await markQueueJob(sb, job.id, {
      status: "sent", last_error: null,
      completed_at: new Date().toISOString(),
      normalized_phone: normalizedPhone,
    });
    await insertRecoveryContact(sb, { ... notes: "sent|followup_dispatch_queue" });
  })
  .catch(async (err) => {
    const msg = err?.message?.slice(0, 500) || "Falha desconhecida";
    await markQueueJob(sb, job.id, {
      status: "failed", last_error: msg,
      completed_at: new Date().toISOString(),
      normalized_phone: normalizedPhone,
    });
    await insertRecoveryContact(sb, { ... notes: `failed_api|${msg}` });
  });

// Não bloqueia — conta como enfileirado
phoneSendCount.set(normalizedPhone, currentCount + 1);
result.sent++; // significa "enfileirado"
```

O job já está como `processing` pelo claim. A fila da instância processa no ritmo dela e o callback atualiza o status final.

**3. Adicionar `"processing"` como status no frontend**
Atualizar `useFollowUpDispatch.ts` e `FollowUpDashboard.tsx` para exibir `processing` (jobs enfileirados aguardando envio real).

**4. Toast mais preciso no dashboard**
Mudar a mensagem de sucesso para "X jobs enfileirados" em vez de "X enviados".

### Resumo de arquivos
- `deploy/backend/src/routes/followup-daily.ts` — fire-and-forget + remover locks
- `src/hooks/useFollowUpDispatch.ts` — adicionar `processing` ao tipo
- `src/components/followup/FollowUpDashboard.tsx` — exibir processing + toast ajustado

### Validação VPS após deploy
```bash
docker compose logs backend --tail=100 | grep "followup-daily"
```

