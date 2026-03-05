

## Corrigir player de áudio no GroupNode

### Problema
O `<audio>` nativo do browser está sendo bloqueado pelo React Flow. Mesmo com `stopPropagation`, o React Flow intercepta eventos pointer no nível do nó, impedindo interação com os controles do `<audio>`. Isso é um problema conhecido do React Flow — elementos interativos dentro de nós custom precisam de tratamento especial.

### Solução
O problema é que o React Flow captura eventos pointer no container do nó. A solução é usar `pointer-events: all` explicitamente no elemento `<audio>` e adicionar `style={{ pointerEvents: 'all' }}` diretamente. Além disso, o `<audio>` precisa de `controlsList` para garantir que todos os controles são visíveis.

Mas o problema principal é provavelmente que o `renderPreview()` para `sendAudio` retorna o player, mas o bloco de fallback genérico no final do `StepRow` (que renderiza o header + `renderPreview()`) pode estar sendo usado em vez do bloco especial. Preciso verificar o fluxo de renderização.

Verificando: o `sendAudio` tem `hasRichPreview = true` (linha inclui "sendAudio"), então cai no bloco genérico que renderiza header + `renderPreview()`. O `renderPreview()` retorna o `<audio>`. Mas o wrapper genérico **não** tem `nopan nodrag nowheel` — apenas o div interno do `renderPreview()` tem.

### Alterações em `src/components/chatbot/GroupNode.tsx`

1. **Wrapper genérico do StepRow** — Adicionar classes `nopan nodrag nowheel` no wrapper quando o tipo for `sendAudio`, para que React Flow não intercepte eventos no nível do step inteiro.

2. **Audio element** — Adicionar `style={{ pointerEvents: 'all' }}` no `<audio>` e no wrapper para forçar interatividade. Adicionar `onTouchStart` stop propagation também.

3. **Garantir height adequado** — Usar `height: 40px` com `min-height: 40px` para que os controles do browser (incluindo barra de progresso e tempo) fiquem visíveis.

### Arquivo alterado
- `src/components/chatbot/GroupNode.tsx`

