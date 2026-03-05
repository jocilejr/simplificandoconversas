

## Fix: Handles posicionados pelo nó inteiro, não pela row

### Causa raiz confirmada

React Flow posiciona handles com `position: absolute` relativo ao **wrapper do nó** (`.react-flow__node-groupBlock`), e NÃO relativo ao `div.relative` pai que colocamos. A regra CSS `top: 50%` resolve para 50% da altura total do nó, jogando os handles para o meio do card em vez de alinhá-los com as rows do footer.

### Solução

Usar `bottom` em vez de `top` no CSS, com valores calculados a partir da estrutura fixa do footer:

- Footer = 2 rows de `h-6` (24px cada) + 1px border-top = ~49px total
- Row 1 (output-0) center = 48 - 12 = **36px** do fundo
- Row 2 (output-1) center = 24 - 12 = **12px** do fundo

**`src/index.css`** — separar e usar `bottom`:

```css
.group-handle-output-0 {
  top: auto !important;
  bottom: 36px !important;
  right: -6px !important;
  transform: translateY(50%) !important;
}
.group-handle-output-1 {
  top: auto !important;
  bottom: 12px !important;
  right: -6px !important;
  transform: translateY(50%) !important;
}
```

Nenhuma mudança no TSX — a estrutura com handles dentro do footer permanece (para organização), mas o posicionamento real é controlado 100% pelo CSS `!important`.

### Arquivos alterados
- `src/index.css`

