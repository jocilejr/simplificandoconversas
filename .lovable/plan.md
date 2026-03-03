

## Junção de Nós Existentes no Canvas

### Problema
A junção só funciona ao arrastar da paleta lateral (HTML5 drag/drop via `onDrop`). Quando um nó já está no canvas, o React Flow usa seu próprio sistema interno de drag (não HTML5), então o `onDrop` nunca é chamado.

### Solução
Adicionar o handler `onNodeDragStop` ao React Flow. Quando o usuário terminar de arrastar um nó existente, verificamos se ele foi solto sobre outro bloco. Se sim:
1. Mover todos os `children` do nó arrastado para o bloco alvo
2. Remover o nó arrastado do canvas
3. Remover edges conectados ao nó removido

### Alterações

**`src/components/chatbot/FlowEditor.tsx`**
- Adicionar callback `onNodeDragStop` que:
  - Usa `findBlockIdUnderCursor` para detectar se o nó foi solto sobre outro bloco
  - Ignora se o alvo é o próprio nó sendo arrastado
  - Concatena os `children` do nó arrastado aos `children` do bloco alvo
  - Remove o nó arrastado e suas edges
  - Mostra toast de confirmação
- Registrar `onNodeDragStop` no componente `<ReactFlow>`

Nenhum outro arquivo precisa ser alterado.

