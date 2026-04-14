

## Reduzir polling de notificações para 3 segundos

Alteração simples em dois arquivos:

### 1. `src/hooks/useTransactionNotifications.ts`
- `refetchInterval: 15_000` → `refetchInterval: 3_000`

### 2. `src/hooks/useUnseenTransactions.ts`
- `refetchInterval: 15_000` → `refetchInterval: 3_000`

### Impacto
- 15 usuários simultâneos = ~600 queries/min (seguro para PostgreSQL)
- Notificações aparecem em até 3s
- Título da aba limpa em até 3s após visualizar transações

