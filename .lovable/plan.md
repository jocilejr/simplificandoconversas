

## Duplicar nós com hover — dentro e fora do grupo

### Abordagem

Adicionar um botão de duplicar (ícone `Copy`) que aparece no hover, tanto em nós standalone (`StepNode`) quanto em steps dentro de grupos (`GroupNode`).

### Alterações

**1. `src/components/chatbot/StepNode.tsx`**
- Adicionar botão `Copy` posicionado `absolute -top-3 -right-3` (similar à lixeira do grupo), visível no hover com `group/node` + `opacity-0 group-hover/node:opacity-100`.
- Ao clicar, dispara evento customizado `node-duplicate` com `{ nodeId }`.
- Não mostrar no trigger.

**2. `src/components/chatbot/GroupNode.tsx`**
- Em cada `StepRow`, adicionar botão `Copy` no canto superior direito do step, visível no hover do step (`group/step` pattern).
- Ao clicar, dispara evento customizado `group-duplicate-step` com `{ nodeId, stepId }`.
- Adicionar botão `Copy` ao lado da lixeira do grupo (`-top-3 -right-12`) para duplicar o grupo inteiro, dispara `node-duplicate`.

**3. `src/components/chatbot/FlowEditor.tsx`**
- Listener para `node-duplicate`: clona o nó (standalone ou grupo) com novo ID, posição deslocada (+40, +40), e adiciona ao canvas.
- Listener para `group-duplicate-step`: encontra o step no grupo, clona com novo ID, e insere logo após o step original (respeitando regra de finalizer).

### Arquivos alterados
- `src/components/chatbot/StepNode.tsx`
- `src/components/chatbot/GroupNode.tsx`
- `src/components/chatbot/FlowEditor.tsx`

