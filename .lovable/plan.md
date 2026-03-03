

## Problemas identificados e correções

### 1. Pan/navegacao no canvas nao funciona
O `panOnDrag={[1, 2]}` combinado com `selectionOnDrag` faz com que o botao esquerdo (0) inicie selecao em vez de pan. Preciso mudar para `panOnDrag` com botao esquerdo como padrao e `selectionOnDrag` desativado (ou apenas com Shift).

### 2. Botao X para remover nao funciona
O `onClick` do botao X chama `e.stopPropagation()`, mas a logica de remocao esta no `onNodeClick` que busca `data-remove-child` no target. O `stopPropagation` impede o evento de chegar ao `onNodeClick`. Preciso mover a logica de remocao para o proprio botao ou remover o stopPropagation.

### 3. Emojis na sidebar e no nodeTypeConfig
Os icones em `nodeTypeConfig` sao emojis. Trocar por nomes de icones Lucide e renderizar componentes Lucide na `NodePalette` e no `BlockNode`.

### Alteracoes

**`src/types/chatbot.ts`**
- Mudar o campo `icon` de emoji string para nome de icone Lucide (ex: `"Zap"`, `"MessageSquare"`, etc.)
- Ou melhor: mudar o tipo para React.ReactNode e importar icones Lucide diretamente

**`src/components/chatbot/NodePalette.tsx`**
- Renderizar icones Lucide em vez de emojis
- Usar os icones do `nodeTypeConfig` (agora Lucide)

**`src/components/chatbot/BlockNode.tsx`**
- Usar icone Lucide do config no header em vez de `MessageCircle` fixo

**`src/components/chatbot/FlowEditor.tsx`**
- Mudar `panOnDrag={[1, 2]}` para `panOnDrag` (true, botao esquerdo)
- Remover `selectionOnDrag` ou usar apenas com tecla modificadora
- Corrigir logica do botao X: mover a remocao do `onNodeClick` para um handler proprio passado via props/contexto ao `BlockNode`

### Abordagem para o X

Em vez de depender do `onNodeClick` para detectar cliques no botao X (fragil), vou passar uma callback `onRemoveChild` para o `BlockNode` via data, e chamar diretamente no onClick do botao. Isso requer que o BlockNode receba a funcao. Como React Flow passa `data` ao node, posso incluir a callback no data do node.

Alternativa mais simples: remover o `e.stopPropagation()` do botao X e deixar o evento propagar ate o `onNodeClick`. Mas isso tambem seleciona o child. Melhor: no `onNodeClick`, processar o remove ANTES de setar selectedNodeId, e dar return apos remover.

Na verdade, o problema e que `stopPropagation` impede que o evento chegue ao React Flow `onNodeClick`. A solucao mais limpa: remover stopPropagation do botao X. O `onNodeClick` ja detecta `data-remove-child` e faz a remocao.

