

## Melhorias no Chatbot Builder

### O que será feito

**1. Formatação de texto rica nos nós "Enviar Texto"**
- Adicionar barra de ferramentas de formatação no campo de texto do nó `sendText` (no PropertiesPanel)
- Botões para **Negrito**, *Itálico*, ~~Riscado~~ e <u>Sublinhado</u> usando sintaxe WhatsApp (`*bold*`, `_italic_`, `~strikethrough~`)
- Preview formatado no corpo do nó no canvas (renderizar a formatação visualmente)

**2. Novo tipo de nó: "Capturar Resposta" (waitForReply)**
- Nó que aguarda e captura a mensagem enviada pelo contato
- Configurações: variável para salvar a resposta, timeout opcional, mensagem de fallback
- Adicionado na categoria "Lógica" da paleta

**3. Anexar nós em bloco (snap/attach vertical)**
- Quando um nó for solto próximo à borda inferior de outro nó, ele se "encaixa" automaticamente abaixo, formando um bloco visual
- Nós anexados se movem juntos como um bloco
- Conexão automática entre nós anexados (sem necessidade de arrastar seta manualmente)
- Visual: bordas arredondadas apenas no topo do primeiro e na base do último nó do bloco

### Arquivos afetados

- `src/types/chatbot.ts` — novo tipo `waitForReply`, campos `replyVariable`, `replyTimeout`, `replyFallback`
- `src/components/chatbot/CustomNode.tsx` — renderização de texto formatado, visual de blocos anexados
- `src/components/chatbot/PropertiesPanel.tsx` — toolbar de formatação no sendText, painel do waitForReply
- `src/components/chatbot/NodePalette.tsx` — adicionar waitForReply na categoria Lógica
- `src/components/chatbot/FlowEditor.tsx` — lógica de snap/attach ao soltar nós próximos, auto-conexão

