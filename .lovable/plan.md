

# Fix: Webhook de boleto — só atualizar, nunca criar

## Mudanças

### 1. `deploy/backend/src/routes/payment.ts`

**Step 3 (linha 635)**: Corrigir `paid_at` para usar `now()`:
```typescript
// Antes:
updateData.paid_at = mpData.date_approved || new Date().toISOString();
// Depois:
updateData.paid_at = new Date().toISOString();
```

**Step 4 (linhas 669-831)**: Substituir todo o bloco de criação por um simples log + return:
```typescript
} else {
  console.log(`[boleto-webhook] No matching transaction for MP payment ${paymentId}, ignoring (boleto not in DB)`);
  return res.sendStatus(200);
}
```

### 2. `src/hooks/useTransactions.ts`

Adicionar segunda query buscando transações aprovadas por `paid_at` no range. Merge + dedup por `id` para que boletos criados dias atrás mas pagos hoje apareçam corretamente.

### 3. `src/components/transactions/TransactionsTable.tsx`

Filtrar aba "aprovados" por `paid_at` dentro do range (linha 219):
```typescript
aprovados: transactions.filter((t) => {
  if (t.status !== "aprovado") return false;
  if (!t.paid_at || !dateStart || !dateEnd) return true;
  const pd = new Date(t.paid_at);
  return pd >= dateStart && pd <= dateEnd;
}),
```

## Resumo

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/payment.ts` | `paid_at = now()` no update + remover criação no Step 4 |
| `src/hooks/useTransactions.ts` | Segunda query por `paid_at` + merge |
| `src/components/transactions/TransactionsTable.tsx` | Filtro de aprovados por `paid_at` |

Só afeta boletos (webhook do Mercado Pago). PIX, cartão e Yampi não são alterados.

