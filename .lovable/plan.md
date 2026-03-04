
## Redesign do GroupNode estilo ManyChat

### Problema
O GroupNode atual mostra steps como linhas compactas (ícone + label + preview em uma linha). O usuario quer o estilo ManyChat da segunda imagem: cada step renderizado como card completo dentro do grupo, com conteudo visivel, delays como pills inline, e o grupo como um container alto com borda arredondada.

### Solucao

Reescrever `GroupNode.tsx` para renderizar cada step internamente com o mesmo visual rico do `StepNode`:

1. **Container do grupo**: Card branco/card com borda arredondada, sombra, header com titulo "WhatsApp · Enviar Mensagem"
2. **Steps internos renderizados como cards completos**:
   - `sendText`: Balao de mensagem com o texto completo visivel (estilo chat bubble cinza)
   - `sendAudio`/`sendImage`/`sendVideo`: Preview de midia com icone
   - `waitDelay`: Pill compacta inline "Aguardando por Xs..." centralizada com fundo claro
   - `waitForReply`: Balao indicando captura de resposta
   - `action`: Badge com icone da acao
   - `condition`/`randomizer`: Card com info da condicao
3. **Handle target** (esquerda) e **handle source** (direita) no container externo
4. **Footer "Proximo Passo"** na parte inferior quando ha conexao de saida
5. **Dock indicator** mantido (borda azul pulsante)

### Arquivos
- **Reescrever**: `src/components/chatbot/GroupNode.tsx` — layout rico estilo ManyChat
