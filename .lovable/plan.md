

## Melhorar aparência dos steps dentro do GroupNode

### Alterações no `src/components/chatbot/GroupNode.tsx` (StepRow)

**1. Imagem (`sendImage`)** — Remover `max-h-[80px]` e `object-cover` para mostrar a imagem inteira com aspect ratio natural. Usar `object-contain` e `max-h-[140px]` com fundo escuro para manter proporção.

**2. Texto (`sendText`)** — Aumentar o box: remover `line-clamp-5`, aumentar padding, usar `line-clamp-8` para textos longos. Aumentar font para `text-[13px]`.

**3. Timer (`waitDelay`)** — Redesenhar como pill compacta centralizada: fundo com cor accent sutil, ícone de relógio + texto "Xs" lado a lado, bordas arredondadas full, tamanho menor.

**4. Áudio (`sendAudio`)** — Melhorar o preview: adicionar botão play circular, waveform com mais barras e cores mais vivas, exibir indicador de duração. Se `simulateRecording`, mostrar badge REC mais estilizado.

**5. Geral** — Refinar espaçamentos, bordas e transições para aspecto mais profissional e consistente.

### Arquivo alterado
- `src/components/chatbot/GroupNode.tsx` — Redesenhar `renderPreview` para image/audio e os blocos especiais de sendText e waitDelay no StepRow.

