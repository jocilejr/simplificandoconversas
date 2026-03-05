

## Corrigir player de áudio no GroupNode

### Problema raiz
O elemento `<audio controls>` nativo do browser **não funciona dentro de nós do React Flow** porque o React Flow intercepta todos os eventos de pointer no nível do nó, mesmo com `stopPropagation`. Isso é uma limitação conhecida. Nenhuma combinação de `nopan/nodrag/nowheel/pointerEvents` resolve completamente.

### Solução
Substituir o `<audio controls>` nativo por um **player customizado simples** usando a API JavaScript `new Audio()`. Isso contorna completamente o problema porque o playback é controlado por código JS, não por controles nativos do browser.

O player terá:
- Botão play/pause (ícone)
- Barra de progresso simples (div com width percentual)
- Duração e tempo atual em texto
- Sem waves, sem controles nativos

### Preview sem URL
Quando não há `mediaUrl`, mostrar apenas ícone de áudio + texto "Nenhum áudio", sem waves.

### Alterações em `src/components/chatbot/GroupNode.tsx`

1. **Remover `<audio controls>`** — substituir por um mini componente `AudioPreviewPlayer` interno com:
   - `useRef` para `new Audio(src)` 
   - `useState` para `isPlaying`, `currentTime`, `duration`
   - Botão play/pause que chama `audio.play()` / `audio.pause()` via onClick com stopPropagation
   - Barra de progresso visual (div bg com width%)
   - Display de tempo `currentTime / duration`

2. **Sem URL** — Mostrar ícone + "Nenhum áudio" (sem waves estáticas)

3. **Manter** badge "Gravando" se `simulateRecording`

### Arquivo alterado
- `src/components/chatbot/GroupNode.tsx`

