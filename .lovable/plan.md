

## Plano: Preview de conteúdo nos steps do GroupNode

### O que muda

O `StepRow` dentro de `GroupNode.tsx` vai exibir previews visuais do conteúdo configurado em cada step, em vez de apenas uma linha de descrição:

- **sendText**: Mostra o texto formatado (até ~3 linhas) em um balão estilo chat, com `whitespace-pre-wrap`
- **sendImage**: Mostra thumbnail da imagem (`mediaUrl`) + caption se houver
- **sendVideo**: Mostra thumbnail do vídeo (`mediaUrl`) com ícone de play overlay + caption
- **sendAudio**: Mostra indicador visual de áudio (waveform simplificada) + badge "Gravando" se `simulateRecording`
- **waitDelay**: Mostra `Aguardar Xs` com ícone de relógio + badge "digitando..." se `simulateTyping`
- **condition/action/waitForReply/aiAgent**: Mantém layout compacto atual com descrição melhorada

### Arquivo a editar

**`src/components/chatbot/GroupNode.tsx`** — Refatorar o `StepRow` para renderizar conteúdo expandido por tipo:

1. Após o header (ícone + label), adicionar uma área de preview condicional:
   - `sendText`: `<p>` com texto truncado em 3 linhas, `parseWhatsAppFormatting` aplicado, fundo mais claro
   - `sendImage`/`sendVideo`: `<img>` com `max-h-[80px] rounded object-cover` + overlay de play para vídeo
   - `sendAudio`: Barra visual estilizada + indicador de gravação
2. Steps sem mídia/texto configurado mantêm o tamanho compacto atual
3. Importar `parseWhatsAppFormatting` de `@/types/chatbot` e ícones extras (`Play`, `Mic`)

