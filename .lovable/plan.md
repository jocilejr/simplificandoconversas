## Implementação: Recuperação Event-Driven

### O que mudou

A recuperação automática agora é **event-driven** (disparada no momento em que a transação é salva), não mais dependente do cron.

### Novo fluxo

```
transação pendente salva
→ dispatchRecovery() chamada imediatamente
→ valida recovery_settings (tipo habilitado)
→ resolve instância (instance_boleto/pix/yampi)
→ insere registro em recovery_queue (status: pending)
→ enfileira na MessageQueue global da instância
→ fila global respeita delay anti-ban
→ ao enviar: atualiza recovery_queue (sent/failed/cancelled)
```

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/lib/recovery-dispatch.ts` | **NOVO** — motor de disparo imediato usando fila global |
| `deploy/backend/src/routes/payment.ts` | `enqueueRecovery` → `dispatchRecovery` |
| `deploy/backend/src/routes/yampi-webhook.ts` | `enqueueRecovery` → `dispatchRecovery` |
| `deploy/backend/src/routes/manual-payment-webhook.ts` | `enqueueRecovery` → `dispatchRecovery` |
| `deploy/backend/src/routes/auto-recovery.ts` | Simplificado para fallback de retry de itens stuck |

### Deploy

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
docker logs deploy-backend-1 --tail 50 -f
```

### Validação

Gerar boleto de teste e verificar nos logs:
- `[recovery-dispatch] Queued tx ...`
- `[queue:INSTANCE] enqueued recovery:TX_ID`
- `[recovery-dispatch] Sent recovery to ...`
