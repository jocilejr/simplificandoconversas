

# Fix: Transações em tempo real na VPS (polling)

## Problema

O hook `useTransactions` usa `supabase.channel()` (Realtime via WebSocket) para detectar novas transações. Na VPS não existe o serviço Supabase Realtime, então novas transações nunca aparecem automaticamente.

## Solução

Substituir a subscription Realtime por **polling a cada 15 segundos** usando `refetchInterval` do React Query — mesmo padrão já usado em outras partes do sistema (ex: Member Area usa 15s).

## Mudança

### `src/hooks/useTransactions.ts`

1. **Adicionar `refetchInterval: 15_000`** nas duas queries (`createdQuery` e `paidQuery`)
2. **Remover todo o `useEffect`** que cria o channel Realtime (linhas 85-100)
3. Remover imports não mais necessários (`useEffect`, `useQueryClient`)

```typescript
// createdQuery
const createdQuery = useQuery({
  queryKey: [...],
  queryFn: async () => { ... },
  enabled: !!user && !!workspaceId,
  refetchInterval: 15_000,
});

// paidQuery
const paidQuery = useQuery({
  queryKey: [...],
  queryFn: async () => { ... },
  enabled: !!user && !!workspaceId && !!startDate && !!endDate,
  refetchInterval: 15_000,
});
```

Resultado: a cada 15 segundos as transações são recarregadas automaticamente, sem depender de WebSocket.

