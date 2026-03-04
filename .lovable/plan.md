

## Problema

O layout da tela de conversas não respeita a altura da viewport. O container principal usa `min-h-screen` no `AppLayout` e `h-full` na página, mas `h-full` só funciona se todos os ancestrais tiverem altura definida. O `<main>` usa `flex-1` sem altura explícita, fazendo o chat crescer indefinidamente em vez de ficar contido na viewport.

## Solução

Corrigir a cadeia de alturas para que o chat fique fixo na viewport com scroll apenas na area de mensagens:

### 1. `src/components/AppLayout.tsx`
- Trocar `min-h-screen` por `h-screen` no container raiz para fixar a altura total
- Adicionar `overflow-hidden` ao container raiz para impedir scroll da pagina inteira

### 2. `src/pages/Conversations.tsx`
- Manter `h-full flex` no container (ja esta correto, vai funcionar com o fix do parent)

### 3. `src/components/conversations/ChatPanel.tsx`
- Adicionar `min-h-0` ao container principal (`flex flex-col h-full`) para permitir que o flex item encolha corretamente
- A area de mensagens (`flex-1 overflow-y-auto`) ja esta correta

### Resultado
A cadeia `h-screen` > `flex-1` > `h-full` > `flex-1 overflow-y-auto` vai conter tudo na viewport. Apenas a area de mensagens tera scroll. Header, input e banner ficam fixos.

