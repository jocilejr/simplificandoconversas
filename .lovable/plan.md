

## Fix: 2 saídas do GroupNode

### Causa raiz

Em `src/index.css`, a classe `.group-handle-source` define:
```css
top: auto !important;
bottom: 16px !important;
```

Isso sobrescreve os valores de `top` inline (`calc(100% - 42px)` e `calc(100% - 18px)`) dos dois handles, forçando ambos para a mesma posição (`bottom: 16px`). Resultado: os dois handles ficam empilhados e parecem ser apenas um.

### Solução

1. **`src/index.css`**: Remover as regras `top` e `bottom` com `!important` da classe `.group-handle-source`. O posicionamento dos handles será controlado exclusivamente pelo inline `style` no componente React.

2. **`src/components/chatbot/GroupNode.tsx`**: Usar classes CSS distintas para os handles quando `hasFinalizerStep` é true (ex: `group-handle-output-0` e `group-handle-output-1`), ou simplesmente não usar a classe `group-handle-source` nos handles com `top` customizado. O handle padrão (sem finalizer) pode manter a classe com `bottom: 16px`.

### Abordagem concreta

- Criar duas novas classes em `index.css`: nenhuma regra de posicionamento — deixar o `style` inline do componente controlar.
- Ou mais simples: **remover `!important` de `top` e `bottom`** na `.group-handle-source`, e usar `!important` apenas nos inline styles via Tailwind/style prop.
- A abordagem mais limpa: remover a regra CSS global de posicionamento da `.group-handle-source` e deixar cada handle definir sua posição via `style` prop.

### Mudanças

**`src/index.css`**: Remover `top: auto !important` e `bottom: 16px !important` de `.group-handle-source`.

**`src/components/chatbot/GroupNode.tsx`**: No handle padrão (single output, sem finalizer), adicionar `bottom: "16px"` no inline style para manter o comportamento atual. Os dois handles do finalizer já têm seus `top` values corretos — sem o `!important` do CSS, eles vão funcionar.

### Arquivos alterados
- `src/index.css`
- `src/components/chatbot/GroupNode.tsx`

