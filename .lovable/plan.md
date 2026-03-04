

## Reformulacao Completa do Chatbot Builder

### Problemas Atuais

1. **IDs duplicados**: `childIdCounter` global e `idCounter` via useRef(1) causam conflitos ao reabrir fluxos salvos — resulta no erro de "two children with same key"
2. **Modelo de "children dentro de blocos"** e extremamente fragil: deteccao DOM para merge, closure stale no onDrop, reordenacao bugada
3. **Painel de propriedades**: tabs de children nao funcionam (onClick vazio)
4. **Codigo morto**: `CustomNode.tsx` e `GroupNode.tsx` nao sao usados
5. **Sem persistencia de IDs**: ao salvar/reabrir, o counter reinicia e gera conflitos

### Nova Arquitetura (inspirada no ManyChat)

Cada step e um no independente no canvas (1 no = 1 acao). Sem sub-itens/children. Conexoes via edges entre nos. Simples, previsivel, sem bugs de merge/reorder.

```text
[Gatilho] --> [Enviar Texto] --> [Aguardar] --> [Enviar Imagem]
                                     |
                                     v
                              [Capturar Resposta] --> [Acao]
```

### Plano de Implementacao

**1. Novo tipo `FlowNodeData` simplificado**

Remover o conceito de `children` e `childId`. Cada no tem seus proprios dados diretamente (sem aninhamento). IDs gerados com `crypto.randomUUID()` para garantir unicidade.

**2. Reescrever `BlockNode.tsx` → `StepNode.tsx`**

Um unico componente de no que renderiza de acordo com `data.type`:
- Header colorido com icone + label do tipo
- Body com preview do conteudo (texto, midia, delay, etc)
- Handle esquerdo (target) + Handle direito (source)
- Sem sub-itens, sem reorder, sem merge

**3. Reescrever `FlowEditor.tsx`**

- Remover toda logica de children, merge, findBlockIdUnderCursor
- Drag from palette ou popover cria um novo no independente no canvas
- Clique em um no abre o PropertiesPanel para aquele no diretamente
- Edges conectam nos sequencialmente (smoothstep)
- IDs com `crypto.randomUUID()`
- Ao carregar fluxo salvo, usar os IDs persistidos (sem counter)

**4. Reescrever `PropertiesPanel.tsx`**

- Recebe o no selecionado diretamente (sem childIndex)
- Edita `node.data` ao inves de `children[index]`
- Remove tabs de children (nao existem mais)
- Mesmos campos de edicao por tipo (trigger, sendText, etc)

**5. Limpar codigo morto**

- Deletar `CustomNode.tsx` e `GroupNode.tsx`

**6. Atualizar `execute-flow` edge function**

Adaptar o loop de execucao para o novo formato: em vez de iterar children dentro de nodes, seguir os edges entre nos sequencialmente (topological sort baseado em edges).

**7. Atualizar `evolution-webhook`**

Ajustar a busca de triggers: em vez de procurar `children[].triggerKeyword`, procurar diretamente `nodes[].data.triggerKeyword` onde `data.type === 'trigger'`.

### Arquivos impactados

- **Criar**: `src/components/chatbot/StepNode.tsx`
- **Reescrever**: `src/components/chatbot/FlowEditor.tsx`, `src/components/chatbot/PropertiesPanel.tsx`
- **Deletar**: `src/components/chatbot/CustomNode.tsx`, `src/components/chatbot/GroupNode.tsx`
- **Editar**: `src/types/chatbot.ts` (remover children), `supabase/functions/execute-flow/index.ts`, `supabase/functions/evolution-webhook/index.ts`

