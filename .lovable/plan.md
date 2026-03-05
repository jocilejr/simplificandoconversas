

## Melhorar aparência dos nós no GroupNode

### Problemas identificados
1. **waitDelay pill** — visual amador, precisa ser mais refinado e profissional
2. **Audio** — não reproduz áudio inline; mostra apenas waveform estática. Precisa de `<audio>` real com controles
3. **Cursor** — todos os steps usam `cursor-grab`, mostrando mãozinha de arrastar em vez de pointer para clique. O clique em step já funciona (via `data-step-id` + `onNodeClick`), mas o cursor não indica isso
4. **Visual geral** — refinamentos para aspecto mais profissional

### Alterações em `src/components/chatbot/GroupNode.tsx`

**1. waitDelay** — Redesenhar como uma linha separadora horizontal elegante com ícone de relógio centralizado e duração, estilo "divider with icon" (linha fina horizontal com pill minimalista no centro, sem bordas grossas).

**2. sendAudio** — Substituir waveform estática por um `<audio>` element real com controles nativos, permitindo ouvir o áudio diretamente do grupo. Manter o badge REC se `simulateRecording`. Adicionar `e.stopPropagation()` no play para não acionar seleção do nó.

**3. Cursor** — Trocar `cursor-grab` por `cursor-pointer` em todos os StepRow wrappers. O drag continua funcionando (HTML5 draggable não depende do cursor CSS). Manter `active:cursor-grabbing` para feedback durante arrasto.

**4. Refinamentos gerais** — Melhorar bordas, sombras internas, e transições hover para aspecto mais polido e profissional em todos os tipos de step.

### Arquivo alterado
- `src/components/chatbot/GroupNode.tsx`

