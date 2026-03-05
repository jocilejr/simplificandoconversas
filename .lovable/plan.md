

## Fix: Linha bugada ao puxar do handle

### Causa raiz

O React Flow aplica `top: 50%` nos handles via CSS interno. Os inline styles `top: "calc(100% - 42px)"` **não vencem** essa regra por especificidade. Resultado: o React Flow calcula a posição da aresta a partir do centro do nó (50%), mas o handle está visualmente em outro lugar — causando a curva estranha.

Prova: o `.group-handle-target` funciona corretamente porque usa `top: 24px !important` via CSS. Os handles de saída perderam o `!important` quando removemos as regras do `.group-handle-source`.

### Solução

Criar classes CSS dedicadas para os dois handles de saída, com posicionamento via `!important` (igual ao `.group-handle-target`):

**`src/index.css`**:
```css
.group-handle-output-0 {
  top: calc(100% - 42px) !important;
}
.group-handle-output-1 {
  top: calc(100% - 18px) !important;
}
.group-handle-source {
  top: auto !important;
  bottom: 16px !important;
}
```

**`src/components/chatbot/GroupNode.tsx`**:
- `output-0`: adicionar classe `group-handle-output-0`, remover `top` do inline style
- `output-1`: adicionar classe `group-handle-output-1`, remover `top` do inline style
- Handle default (sem finalizer): restaurar classe `group-handle-source` com as regras `!important` de volta

### Arquivos alterados
- `src/index.css`
- `src/components/chatbot/GroupNode.tsx`

