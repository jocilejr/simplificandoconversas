

## Diagnóstico real

Olhando o código atual e a screenshot, os problemas são:

1. **Parte branca/cinza atrás do bloco**: O wrapper externo (`div.relative`) não tem `bg-transparent`, então o fundo padrão do React Flow node aparece por trás do card com `rounded-2xl`. O React Flow aplica um fundo ao `.react-flow__node` que vaza nos cantos arredondados.

2. **Handles presos no meio**: React Flow internamente aplica `top: 50%` como inline style nos `Handle` components. Nosso `style={{ top: 'auto', bottom: 16 }}` é passado como prop, mas o React Flow pode sobrescrever com seu próprio cálculo de posição. A solução confiável é usar CSS com `!important` via classes customizadas.

### Alterações

**`src/index.css`** — Adicionar classes CSS específicas para os handles do GroupNode:
```css
.group-handle-target {
  top: 24px !important;
}
.group-handle-source {
  top: auto !important;
  bottom: 16px !important;
}
```

**`src/components/chatbot/GroupNode.tsx`**:
- Handle target: adicionar className `group-handle-target` e remover `style={{ top: 24 }}`
- Handle source: adicionar className `group-handle-source` e remover `style={{ top: 'auto', bottom: 16 }}`
- Adicionar `!bg-transparent` no wrapper externo para eliminar qualquer fundo que vaze pelos cantos do card
- Adicionar estilo no `.react-flow__node-group` via CSS para garantir `background: transparent`

**`src/index.css`** — Adicionar regra para nó group:
```css
.react-flow__node-group {
  background: transparent !important;
}
```

