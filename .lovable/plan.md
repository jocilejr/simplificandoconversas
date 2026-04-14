

## Problema

O badge de notificação (sininho 🔔) e o título da aba só limpam quando o usuário clica no popup de notificações e faz "dismiss". Quando o usuário acessa a aba de transações correspondente (ex: "Aprovados"), deveria limpar automaticamente — mas os dois sistemas são independentes e não se comunicam.

- `useUnseenTransactions` → controla `document.title` via `viewed_at` no banco (depende do backend VPS responder ao `markTabSeen`)
- `useTransactionNotifications` → controla o badge do sininho via estado in-memory (nunca se conecta ao `markTabSeen`)

## Solução

Conectar os dois sistemas: quando o usuário acessa uma aba de transações, limpar automaticamente as notificações in-memory correspondentes àquela aba.

### 1. `src/hooks/useTransactionNotifications.ts`
- Adicionar função `dismissByTab(tab: TabKey)` que remove do array in-memory todas as notificações que correspondem ao tipo/status daquela aba
- Mapear tabs para filtros: `aprovados` → status=aprovado, `boletos-gerados` → type=boleto+status=pendente, etc.
- Exportar essa função no retorno do hook

### 2. `src/components/AppLayout.tsx`
- Expor `dismissByTab` do hook para os filhos via contexto ou passando direto

### 3. `src/components/transactions/TransactionsTable.tsx`
- Importar `useTransactionNotifications` (ou receber `dismissByTab` como prop/contexto)
- No `useEffect` que chama `markTabAsSeen`, também chamar `dismissByTab(tab)` para limpar as notificações in-memory correspondentes

### Alternativa mais simples (preferida)
Em vez de criar contexto, colocar a lógica de limpeza diretamente no `useTransactionNotifications`:
- O hook já faz polling das transações com `viewed_at IS NULL`
- Quando o polling retorna, **remover** do array in-memory qualquer notificação cujo `id` não esteja mais na lista de unseen (ou seja, já foi marcado como visto pelo backend)
- Isso garante sincronização automática: quando `markTabSeen` atualiza o banco, o próximo polling limpa as notificações in-memory

### Detalhes técnicos

```typescript
// useTransactionNotifications.ts — sincronizar in-memory com banco
useEffect(() => {
  if (!recentTx) return;
  const unseenIds = new Set(recentTx.map(tx => tx.id));
  setNotifications(prev => prev.filter(n => unseenIds.has(n.id)));
}, [recentTx]);
```

Isso resolve o problema sem criar acoplamento entre componentes — o polling já traz as transações unseen, e qualquer uma que foi marcada como vista (por `markTabSeen`) automaticamente sai da lista in-memory no próximo ciclo de 15s.

