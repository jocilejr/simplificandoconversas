

# Fix: Transação aparecendo no período errado

## Problema

Dois bugs na filtragem de transações aprovadas na `TransactionsTable`:

1. **Dependências faltando no `useMemo`**: o `tabTransactions` depende de `dateStart` e `dateEnd` mas o array de dependências só tem `[transactions]`. Quando as datas mudam mas as transações em cache não mudam imediatamente, o filtro usa valores antigos.

2. **`paid_at` nulo passa no filtro**: linha 221 faz `if (!t.paid_at) return true` — se o webhook não setou `paid_at` (ou houve delay), a transação aprovada aparece em QUALQUER período, incluindo "Ontem" quando foi paga hoje.

## Solução

### `src/components/transactions/TransactionsTable.tsx`

Duas mudanças cirúrgicas:

**A) Corrigir o filtro de aprovados (linhas 219-224):**
- Se `paid_at` existe → filtrar por `paid_at` (como já faz)
- Se `paid_at` é null → filtrar por `created_at` como fallback (em vez de incluir cegamente)

```typescript
aprovados: transactions.filter((t) => {
  if (t.status !== "aprovado") return false;
  if (!dateStart || !dateEnd) return true;
  const relevantDate = new Date(t.paid_at || t.created_at);
  return relevantDate >= dateStart && relevantDate <= dateEnd;
}),
```

**B) Adicionar dependências no useMemo (linha 232):**
```typescript
}), [transactions, dateStart, dateEnd]);
```

Resultado: transação paga hoje só aparece no filtro "Hoje", não em "Ontem".

