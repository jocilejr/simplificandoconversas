

## Diagnóstico dos 3 problemas persistentes

### 1. Parte branca/cinza atrás do bloco
A div do card (linha 198) tem `overflow-hidden`, mas a barra de destaque (linha 208) usa `absolute` e se posiciona relativa ao wrapper externo (`relative` na linha 190), não ao card. Isso cria um artefato visual. **Solução**: adicionar `relative` ao card para que a barra se posicione dentro dele.

### 2. Handle de saída (source) preso no meio
React Flow aplica `top: 50%` como **inline style** nos handles de posição Right. Classes Tailwind com `!important` (`!top-auto !bottom-4`) nem sempre sobrescrevem inline styles do React Flow. **Solução**: usar `style={{ top: 'auto', bottom: 16 }}` diretamente no Handle, que sempre vence inline vs inline.

### 3. Conexão entra pelo meio mesmo com handle no topo
O handle target está correto com `style={{ top: 24 }}`, mas React Flow também pode aplicar `top: 50%` inline em handles Left. **Solução**: garantir que o `style` inline está correto e verificar que não há CSS global sobrescrevendo (`.block-handle-target` em `index.css` força `top: 50% !important` — esse é o problema).

### CSS global conflitante (`index.css`)
As classes `.block-handle-target` e `.block-handle-source` em `index.css` (linhas 136-144) forçam `top: 50% !important` em **todos** os handles. Embora o GroupNode não use a classe `block-handle`, o React Flow pode aplicar estilos inline `top: 50%` que competem com nossas classes.

### Alterações

**`src/components/chatbot/GroupNode.tsx`:**
- Adicionar `relative` ao card div para conter a barra de destaque
- Handle target: manter `Position.Left` com `style={{ top: 24 }}` 
- Handle source: trocar classes `!top-auto !bottom-4` por `style={{ top: 'auto', bottom: 16 }}` para garantir override do inline style do React Flow

