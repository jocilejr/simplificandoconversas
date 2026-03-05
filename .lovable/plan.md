

## Organizar regras de "Aguardar Mensagem" e "Aguardar Clique" dentro de grupos

Os steps `waitForReply` e `waitForClick` devem ser tratados como "finalizadores" de grupo: sempre ficam na última posição, no máximo 1 por grupo, e determinam as saídas (2 handles: sucesso + timeout).

### Mudanças

#### 1. `src/components/chatbot/GroupNode.tsx` — UI do popover e rodapé

- **Filtrar tipos no popover "Adicionar ação"**: se o grupo já contém um step `waitForReply` ou `waitForClick`, remover ambos da lista `addableTypes` exibida no popover.
- **Remover bolinhas decorativas** do rodapé (os `div` com `w-2.5 h-2.5 rounded-full`) que criam confusão visual com os handles reais. Manter apenas os textos "Continuou ✓" e o label de timeout.

#### 2. `src/components/chatbot/FlowEditor.tsx` — Lógica de posicionamento e validação

**a) No handler `group-add-step`** (~linha 392):
- Se `stepType` é `waitForReply` ou `waitForClick`, verificar se o grupo já tem um. Se sim, mostrar toast de erro e retornar.
- Caso contrário, adicionar normalmente (já vai para o final).

**b) No handler `group-reorder-step`** (~linha 382):
- Após reordenar, verificar se o último step é um `waitForReply`/`waitForClick`. Se a reordenação moveu ele para fora da última posição, bloquear a operação (não aplicar) e mostrar toast informativo.

**c) No handler de docking `onNodeDragStop`** (~linha 262):
- Ao montar `mergedSteps`, verificar se já existe um finalizador nos `existingSteps`. Se o `newSteps` contém outro finalizador, bloquear o merge (toast de erro, retornar sem agrupar).
- Após montar `mergedSteps`, garantir que qualquer step `waitForReply`/`waitForClick` fique na última posição (mover automaticamente para o final do array).

**d) No handler `group-receive-step`** (~linha 467):
- Mesma validação: se o grupo destino já tem um finalizador e o step sendo recebido é outro finalizador, bloquear com toast.
- Se o step recebido é um finalizador, colocá-lo na última posição.

### Resultado
- Máximo 1 finalizador por grupo, sempre na última posição
- O grupo ganha 2 saídas quando tem finalizador (já implementado)
- Não é possível adicionar steps depois do finalizador
- Bolinhas decorativas removidas para evitar confusão com os handles reais

### Arquivos alterados
- `src/components/chatbot/GroupNode.tsx`
- `src/components/chatbot/FlowEditor.tsx`

