

## Problema

O `enqueueRecovery` é chamado apenas no webhook (linha 697) e nunca no endpoint de criação (`POST /payment/create`, linha 338). Quando o boleto é gerado pela UI, o webhook do Mercado Pago recebe `pending → pending` e faz skip. Resultado: nenhum caminho enfileira a transação.

## Solução

Adicionar chamada a `enqueueRecovery` logo após `Transaction saved` (linha 338) no `deploy/backend/src/routes/payment.ts`.

## Alteração

| Arquivo | O que muda |
|---------|-----------|
| `deploy/backend/src/routes/payment.ts` | Inserir bloco após linha 338 que chama `enqueueRecovery` incondicionalmente (sem depender de webhook ou status externo) |

Código a inserir após a linha 338 (`console.log("[payment] Transaction saved:", tx?.id);`):

```typescript
// Auto-recovery: enqueue immediately upon transaction creation
if (tx?.id && customer_phone) {
  try {
    await enqueueRecovery({
      workspaceId,
      userId,
      transactionId: tx.id,
      customerPhone: customer_phone,
      customerName: customer_name || null,
      amount: amount,
      transactionType: isBoleto ? "boleto" : "pix",
    });
  } catch (enqErr: any) {
    console.error("[payment] Recovery enqueue error:", enqErr.message);
  }
}
```

A função `enqueueRecovery` já importada (linha 4) faz internamente a verificação de `enabled_boleto`/`enabled_pix` e de duplicatas. Se o tipo não estiver ativado, simplesmente retorna sem enfileirar.

## Deploy na VPS

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
docker logs deploy-backend-1 --tail 50 -f
```

Gerar um boleto de teste e confirmar que aparece `[auto-recovery] Enqueued tx ...` logo após `[payment] Transaction saved`.

