

## Fix: Layout e 2 saídas do GroupNode

### Problema
O `overflow-hidden` no card corta os handles do React Flow. Mover o footer para fora do card criou um layout quebrado — o footer fica desconectado visualmente e os handles continuam não aparecendo corretamente.

### Solução

Abordagem simples: **remover `overflow-hidden` do card** e colocar o footer de volta dentro dele. Sem `overflow-hidden`, os handles (que estão no wrapper externo `relative`) ficam visíveis normalmente. Para manter cantos arredondados no conteúdo interno (imagens, etc.), aplicar `rounded-xl` apenas nos elementos internos que precisam.

### Mudanças em `src/components/chatbot/GroupNode.tsx`

1. **Trocar `overflow-hidden` por `overflow-visible`** na classe do card div (linha 362).

2. **Mover o footer de volta para dentro do card** (antes do `isDockTarget`), removendo o bloco externo (linhas 479-488).

3. **Garantir que o footer tenha borda superior** (`border-t`) para separar visualmente dos steps.

4. **Ajustar posição dos handles** — como o footer agora está dentro do card, os valores de `top` dos handles devem alinhar com as labels "Continuou ✓" e "Se não clicou ⏱" que estarão no final do card.

### Arquivo alterado
- `src/components/chatbot/GroupNode.tsx`

