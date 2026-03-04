

## Plano: Corrigir extração de step do grupo

### Problema raiz

Quando um step é extraído do grupo, o novo nó criado reutiliza `removedStep.id` como ID do nó. Esse ID pode colidir com referências internas do React Flow (evidenciado pelo erro de console "Encountered two children with the same key"). Além disso, o grupo restante pode não re-renderizar corretamente porque a atualização imutável dos dados não está forçando um novo render do componente memoizado.

### Correções em `src/components/chatbot/FlowEditor.tsx`

1. **Gerar um novo ID único** para o nó extraído em vez de reusar `removedStep.id`:
   ```typescript
   const newNodeId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
   ```

2. **Transferir edges** do grupo para o nó extraído quando o grupo fica vazio, e criar edges do grupo para o novo nó quando o grupo permanece:
   - Se o grupo ficou vazio: mover edges que apontavam para/do grupo para o novo nó
   - Se o grupo permanece: não precisa transferir edges

3. **Forçar re-render do grupo** garantindo que o objeto do nó é completamente novo (spread profundo no data e no nó):
   ```typescript
   return nds.map((n) => {
     if (n.id !== nodeId) return n;
     return { ...n, data: { ...data, steps: [...remainingSteps] } };
   });
   ```

4. **Atualizar edges quando grupo fica vazio**: transferir as conexões do grupo removido para o novo nó extraído.

### Arquivo editado

- `src/components/chatbot/FlowEditor.tsx` — handler do evento `group-extract-step` (linhas ~402-441)

