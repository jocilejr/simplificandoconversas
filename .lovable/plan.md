

## Problema

Existem **dois sistemas concorrentes** controlando o `document.title`:

1. **`useUnseenTransactions`** (linha 73-83) — conta transações com `viewed_at IS NULL` e define o título como `(N) Nova transação! | Simplificando`. Este nunca limpa porque `viewed_at` só é atualizado via API do backend (`platform/mark-seen`/`platform/mark-tab-seen`), que depende de clicar nas abas da tabela de transações.

2. **`useTransactionNotifications`** (linha 118-141) — controla título com base nas notificações in-memory, que só limpam com `dismissAll`.

Ambos fazem `setInterval` de 1s sobrescrevendo `document.title`, criando conflito. Mesmo que você limpe um, o outro mantém o título alterado.

## Solução

Unificar a lógica de título no `useUnseenTransactions` (que é o sistema correto baseado em `viewed_at`) e **remover** a lógica de título do `useTransactionNotifications`.

### 1. `src/hooks/useTransactionNotifications.ts`
- **Remover** todo o bloco de tab title flashing (linhas 118-141)
- O hook continua gerenciando apenas as notificações in-app (popup) e browser notifications

### 2. `src/hooks/useUnseenTransactions.ts`  
- **Remover** a assinatura Realtime (linhas 49-67) que não funciona na VPS
- Adicionar `refetchInterval: 15_000` na query para polling
- Manter a lógica de `document.title` que já existe (linhas 73-83) — esta é a correta pois se baseia no `viewed_at` do banco

### 3. `src/components/transactions/TransactionsTable.tsx`
- Verificar se `markTabSeen` está sendo chamado ao entrar na página de transações (não só ao trocar de aba)
- Adicionar chamada automática de `markTabSeen` para a aba ativa quando a página `/transacoes` é montada

### Resultado
- Quando o usuário abre `/transacoes`, o backend marca as transações como vistas (`viewed_at = now()`)
- O polling detecta que não há mais transações sem `viewed_at`
- O título volta ao normal automaticamente
- Sem conflito entre dois sistemas

