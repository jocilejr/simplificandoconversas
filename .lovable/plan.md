

## Corrigir saídas e botão "Adicionar ação" no GroupNode

### Problemas identificados

1. **3 saídas aparecendo**: A variável `hasTimeoutOutputs` exige `timeout > 0` para mostrar as 2 saídas. Mas o handle padrão (único) sempre renderiza quando `hasTimeoutOutputs` é false. Quando o timeout está configurado, as 2 saídas aparecem, mas o handle padrão também pode estar visível. O correto é usar `hasFinalizerStep` (que já existe) para decidir entre 1 ou 2 saídas.

2. **Botão "Adicionar ação" visível após finalizador**: O popover filtra os tipos `waitForReply`/`waitForClick` da lista, mas o botão continua aparecendo. Deve ser **completamente escondido** quando o grupo tem um finalizador.

### Mudanças em `src/components/chatbot/GroupNode.tsx`

1. **Usar `hasFinalizerStep` em vez de `hasTimeoutOutputs`** para:
   - Decidir a largura do nó (`w-[320px]` vs `w-[280px]`)
   - Renderizar o rodapé com labels "Continuou ✓" / "Se não respondeu/clicou ⏱"
   - Escolher entre 2 handles de saída ou 1 handle padrão

2. **Esconder o botão "Adicionar ação"** completamente quando `hasFinalizerStep` é true (o `div` com o Popover inteiro).

3. **Ajustar label do timeout** para usar `hasFinalizerStep` e buscar o tipo do finalizador diretamente.

### Arquivo alterado
- `src/components/chatbot/GroupNode.tsx`

