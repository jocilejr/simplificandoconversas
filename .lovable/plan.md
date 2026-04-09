

# Fix: Dot não desaparece ao visualizar abas de transações

## Problema

O `useEffect` atual (linha 233-247) tem dois bugs:

1. **Ignora a aba inicial**: No primeiro render, `isFirstRender` pula o efeito. Quando o usuário abre a página de Transações, a aba "Aprovados" já está ativa mas nunca é marcada como vista.

2. **Só dispara quando `activeTab` muda**: Se o usuário clica na aba que já está ativa, nada acontece. E como a aba inicial nunca é processada, o dot persiste para sempre.

## Solução

**Arquivo:** `src/components/transactions/TransactionsTable.tsx`

Substituir a lógica do useEffect (linhas 229-247) por:

1. **Remover `isFirstRender`** — a aba inicial também deve ser marcada como vista.
2. **Marcar como visto quando `activeTab` muda** (incluindo o valor inicial).
3. Usar `prevTab` apenas para evitar re-execuções desnecessárias quando o efeito re-roda por mudança em `tabTransactions` sem mudança de aba.

Lógica nova:
```typescript
const prevTab = useRef<TabKey | null>(null);

useEffect(() => {
  if (prevTab.current === activeTab) return;
  prevTab.current = activeTab;
  const currentTxs = tabTransactions[activeTab] || [];
  const unseenIds = currentTxs.filter((t) => !t.viewed_at).map((t) => t.id);
  if (unseenIds.length > 0) {
    markSeen(unseenIds);
  }
}, [activeTab, markSeen, tabTransactions]);
```

Inicializando `prevTab` como `null` garante que na primeira execução (`null !== "aprovados"`), o efeito processa a aba inicial e marca as transações como vistas. Nas execuções seguintes, só processa quando o usuário troca de aba.

