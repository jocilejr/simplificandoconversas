

## Correções do GroupNode

### Problemas identificados

1. **Parte branca atrás**: O `borderLeft: 4px solid` cria uma borda que, combinada com `overflow-hidden` e `rounded-2xl`, gera artefato visual branco. Solucao: usar uma div interna como barra de cor absoluta posicionada.
2. **Handle de entrada no topo**: Deve ser `Position.Left` com `top: 24` para ficar no canto superior esquerdo.
3. **Handle de saída no meio**: O xyflow aplica `top: 50%` por padrao e o `style={{ bottom: 16, top: 'auto' }}` nao sobrescreve corretamente. Solucao: calcular a posicao absoluta ou usar classes CSS com `!important` para forcar `top: auto` e `bottom`.

### Alteracoes em `GroupNode.tsx`

- **Handle target**: `Position.Left` com `style={{ top: 24 }}` e classe `!-left-1.5`
- **Handle source**: `Position.Right` com classes `!-right-1.5` e usar estilo inline `top` calculado ou usar `Position.Bottom` com `style={{ right: ... }}`
- **Borda esquerda**: Remover `borderLeft` do style e usar uma div absoluta `absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl` com a cor de destaque, evitando o artefato branco

