

## Redesign GroupNode — Fidelidade ao ManyChat

### Diferenças identificadas (imagem ManyChat vs atual)

1. **Borda lateral esquerda azul/roxa** em vez de barra de cor no topo
2. **Header**: ícone de chat + "WhatsApp" (label pequeno) + "Enviar Mensagem" (título) — layout em duas linhas
3. **Texto**: balões de fala com "tail" (cauda) à esquerda, fundo cinza claro, alinhados à esquerda com padding generoso
4. **Wait/Delay**: pill centralizada com ícone de relógio e texto "Aguardando por X segundos..." (texto completo, não abreviado)
5. **Sem dividers** entre steps — fluxo contínuo com espaçamento natural
6. **Footer**: "Próximo Passo" centralizado com ícones pequenos (círculos coloridos)
7. **Sombra suave** e cantos mais arredondados
8. **Largura maior** (~300px) para acomodar textos longos

### Alterações em `src/components/chatbot/GroupNode.tsx`

- Remover `h-[3px]` color bar do topo → adicionar `border-l-4` com cor do tipo
- Header: duas linhas — "WhatsApp" em `text-[10px] text-muted-foreground` e título em `text-[13px] font-semibold`
- `sendText`: balão com `rounded-2xl rounded-bl-sm` (tail inferior esquerdo), `bg-muted/60`, padding `px-4 py-2.5`, texto `text-[13px]`
- `waitDelay`: pill com texto completo "Aguardando por {X} segundos...", clock icon, fundo sutil
- Remover `divide-y` — usar `space-y-1` ou gap natural
- Footer: "Próximo Passo" com círculos decorativos
- Largura para `w-[300px]`

### Arquivo
- **Reescrever**: `src/components/chatbot/GroupNode.tsx`

