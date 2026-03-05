

## Plano: Mostrar status "Aguardando resposta" no banner de fluxo ativo

O banner no `ChatPanel.tsx` (linha 267) só trata `waiting_click`, e qualquer outro status cai para "Executando". Precisa adicionar o caso `waiting_reply`.

### Alteração

**`src/components/conversations/ChatPanel.tsx`** — Linha 267: trocar o ternário simples por uma cadeia que cubra os 3 estados:
- `waiting_click` → "Aguardando clique"
- `waiting_reply` → "Aguardando resposta"
- default → "Executando"

Alteração de 1 linha, sem impacto em outros arquivos.

