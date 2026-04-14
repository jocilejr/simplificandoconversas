

## Fix: Título "(2) Nova transação!" persistente após visualização

### Problema identificado
Há uma **race condition** no fluxo de marcação de transações como vistas:

1. `markTabAsSeen()` verifica `hasUnseen(tab)` antes de chamar a API. Mas `hasUnseen` depende dos `counts` do query `useUnseenTransactions`, que pode não ter retornado ainda quando o `useEffect` de "initial load" dispara.
2. O `useEffect` de "initial load" usa `initialDone.current = true` — então mesmo que os counts cheguem depois, ele nunca re-executa.
3. Quando o usuário já está na aba e novas transações chegam (via polling), elas **não são marcadas como vistas** — o código só marca no switch de aba ou no load inicial.

### Solução

**Arquivo:** `src/components/transactions/TransactionsTable.tsx`

1. **Remover a guarda `hasUnseen`** do `markTabAsSeen` — chamar `markTabSeen` sempre que o usuário visualiza uma aba. O backend já faz no-op se não houver registros para atualizar.

2. **Adicionar auto-mark contínuo** — se o usuário está com a aba aberta e novas transações chegam (counts > 0), marcar automaticamente após um breve delay (2s), pois o usuário já está visualizando.

3. **Remover `initialDone` ref** — não é mais necessário com a lógica simplificada.

**Arquivo:** `src/hooks/useUnseenTransactions.ts`

4. Sem alterações — a lógica do hook está correta.

### Mudanças detalhadas

```typescript
// TransactionsTable.tsx — substituir bloco de marcação (linhas ~235-256)

// On tab change — always mark
useEffect(() => {
  if (prevTab.current === activeTab) return;
  prevTab.current = activeTab;
  markTabSeen(activeTab);
}, [activeTab, markTabSeen]);

// On initial load — mark once
useEffect(() => {
  if (isLoading) return;
  markTabSeen(activeTab);
}, [isLoading]); // intentionally sparse deps

// Auto-mark while viewing: if new unseen arrive while user is on tab, mark after 2s
useEffect(() => {
  if (!hasUnseen(activeTab)) return;
  const timer = setTimeout(() => markTabSeen(activeTab), 2000);
  return () => clearTimeout(timer);
}, [hasUnseen, activeTab, markTabSeen]);
```

### Resultado esperado
- Ao abrir a página de transações, as transações da aba ativa são marcadas como vistas imediatamente
- Se novas transações chegam enquanto o usuário está na página, são marcadas como vistas em 2s
- O título "(N) Nova transação!" limpa automaticamente

