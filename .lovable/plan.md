

## Melhorar reordenação de steps dentro do grupo

### Problema
Os steps dentro do grupo usam `draggable` diretamente no elemento inteiro, fazendo com que qualquer clique que se mova minimamente inicie um drag acidental. Isso causa reordenações indesejadas.

### Solução
Adicionar um **drag handle dedicado** (ícone de arrastar `GripVertical`) em cada step. Apenas ao segurar esse ícone o drag será iniciado. Clicar no corpo do step continuará abrindo o painel de propriedades normalmente.

### Alterações

**`src/components/chatbot/GroupNode.tsx`**

1. Remover `draggable` do container principal de cada `StepRow`.
2. Adicionar um ícone `GripVertical` (lucide) no lado esquerdo de cada step, visível no hover do step.
3. O `GripVertical` terá `draggable="true"` e os handlers `onDragStart`/`onDragEnd`. O `setDragImage` apontará para o container pai para manter o visual do drag.
4. O container do step mantém `onDragEnter` e `onDragOver` para aceitar drops, mas não inicia drags sozinho.
5. Aplicar o mesmo padrão aos tipos especiais (`waitDelay`, `waitForClick`, `sendText` inline) — todos ganham o grip handle.

### Resultado
- Clique no step → abre propriedades (sem drag acidental)
- Segurar o grip → arrasta para reordenar
- Soltar fora do grupo → extrai o step (comportamento existente preservado)

### Arquivos alterados
- `src/components/chatbot/GroupNode.tsx`

