## Problema

O hook `useMessages` filtra apenas mensagens `inbound` (linha 30: `.eq("direction", "inbound")`), descartando todas as mensagens enviadas. Além disso, o realtime só escuta eventos `INSERT`, ignorando `UPDATE` (ex: mudança de status de "sending" para "delivered").

## Correções

### 1. `src/hooks/useMessages.ts` — Remover filtro de direção e melhorar realtime

- Remover `.eq("direction", "inbound")` da query para buscar TODAS as mensagens (inbound + outbound)
- Expandir o listener realtime de `event: "INSERT"` para `event: "*"` para capturar inserções, atualizações de status e exclusões em tempo real
- Ajuste a sincronização para pegar todas as permissões do webhook das instancias do evolution. Dessa forma a plataforma vai ter todos os eventos relacionados àquela instancia e permitirá uma integração mais precisa.

### Resultado

Todas as mensagens (enviadas e recebidas) aparecerão no chat, com atualizações de status em tempo real. O ChatPanel já renderiza corretamente mensagens outbound (balões verdes à direita com ícones de status), então nenhuma alteração é necessária na UI.