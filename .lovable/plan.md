

# Fix: Recuperação automática para boletos gerados via API

## Problema identificado
O arquivo `deploy/backend/src/routes/platform-api.ts` cria transações de boleto via API externa (endpoint `/api/platform/generate-payment`) mas **nunca chama `dispatchRecovery()`** após salvar a transação. Por isso, boletos gerados por API não entram no sistema de recuperação automática.

O endpoint manual (`/api/payment/create` em `payment.ts`) chama `dispatchRecovery` na linha 354. A API externa não.

## Solução

### Arquivo: `deploy/backend/src/routes/platform-api.ts`

Após a inserção da transação (linha ~1206), adicionar chamada ao `dispatchRecovery`:

1. Importar `dispatchRecovery` no topo do arquivo
2. Após `logApiRequest(userId, workspaceId, req, 200, ...)` e antes do `res.json(result)`, adicionar:

```typescript
// Auto-recovery: enqueue if pending and has phone
if (tx?.id && customer_phone && (STATUS_MAP[mpData.status] || "pendente") === "pendente") {
  try {
    await dispatchRecovery({
      workspaceId,
      userId,
      transactionId: tx.id,
      customerPhone: customer_phone,
      customerName: customer_name || null,
      amount: Number(amount),
      transactionType: paymentType === "boleto" ? "boleto" : "pix",
    });
  } catch (enqErr: any) {
    console.error("[platform/generate-payment] Recovery enqueue error:", enqErr.message);
  }
}
```

Isso garante que qualquer boleto ou PIX criado via API externa também entre na fila de recuperação automática, igual ao fluxo manual.

