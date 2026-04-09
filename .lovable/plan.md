

# Fix: Green dot não aparece nas transações

## Problema

O `useEffect` que chama `markSeen` (linha 230-236 do `TransactionsTable.tsx`) dispara automaticamente no mount do componente e a cada mudança de `tabTransactions`. Isso significa que quando uma nova transação chega via realtime:

1. `useTransactions` refaz o fetch → nova transação aparece
2. `tabTransactions` recomputa → `useEffect` dispara
3. `markSeen` marca como visto imediatamente (milissegundos)
4. O dot desaparece antes do usuário perceber

O dot nunca fica visível porque o `markSeen` é chamado automaticamente, não apenas quando o usuário troca de aba.

## Solução

**Arquivo:** `src/components/transactions/TransactionsTable.tsx`

Mudar a lógica para que `markSeen` só seja chamado quando o usuário **manualmente troca de aba**, não no mount nem quando os dados mudam:

1. Adicionar um `useRef` para rastrear se é a primeira renderização e qual aba o usuário trocou
2. Substituir o `useEffect` automático por uma chamada dentro do handler `setActiveTab`
3. Não marcar como visto automaticamente no mount — apenas quando o usuário clica na aba

Lógica concreta:
- Criar `const isFirstRender = useRef(true)` 
- No useEffect atual, ignorar se `isFirstRender.current === true` (setar `false` após)
- Só chamar `markSeen` quando `activeTab` mudar (não quando `tabTransactions` mudar)
- Remover `tabTransactions` das dependências do useEffect

Resultado: o dot verde aparece e persiste até o usuário clicar na aba correspondente.

