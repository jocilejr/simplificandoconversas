

## Plano: Substituir autosave por botão "Salvar"

### Problema
O autosave com debounce de 1.5s causa race conditions com o React Query, resultando em dados sobrescritos e inconsistências.

### Mudanças

**`src/components/chatbot/FlowEditor.tsx`**

1. **Remover** o `useEffect` de autosave (linhas 111-144) e os refs `saveTimeoutRef`, `historyTimeoutRef`, `isInitialMount`
2. **Substituir** o indicador de status (linhas 911-921) por um botão "Salvar":
   - Ícone de disquete + texto "Salvar"
   - Estado `saving` mostra spinner
   - Estado `saved` mostra check verde por 2s
   - Detectar mudanças pendentes (`hasChanges`) comparando estado atual vs último save, destacando o botão visualmente
3. **Adicionar** função `handleManualSave` que chama `onSave(name, nodes, edges, instanceNames)` e salva snapshot no histórico
4. **Adicionar** atalho `Ctrl+S` / `Cmd+S` para salvar rapidamente

**`src/hooks/useChatbotFlows.ts`**

5. **Remover** `onSuccess: invalidateQueries` do `updateFlow` — a invalidação será feita apenas ao sair do editor

**`src/pages/ChatbotBuilder.tsx`**

6. **Adicionar** `invalidateQueries` no `onBack` para atualizar a lista ao voltar

### Também incluído
7. **Adicionar `sendFile`** ao array de tipos do popover "Adicionar Nó" (linha 934) — correção do bug reportado anteriormente

