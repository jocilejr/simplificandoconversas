

## Redesign do Dialog de Programação (Grupos)

Baseado no repositório de referência `jocilejr/whats-grupos`, vou redesenhar completamente o `GroupMessagesDialog` e o `GroupScheduledMessageForm` para seguir o padrão do projeto de referência.

### Problemas atuais
1. O formulário de edição abre **inline no final da lista** — deveria abrir como **popup (Dialog separado)**
2. Preview da mensagem é uma linha truncada de 80 chars — deveria ser **card expansível** com conteúdo completo
3. Layout CSS continua quebrando com muitos itens

### Mudanças planejadas

#### 1. `GroupMessagesDialog.tsx` — Redesign completo
- Cada card de mensagem agora é **expansível** (clique para expandir/recolher)
- Card colapsado mostra: badge de horário, ícone do tipo, preview do texto, pills dos dias da semana (se weekly), switch ativo/inativo
- Card expandido mostra **duas sub-abas**: "Conteúdo" (texto completo, mídia, flags) e "Programação" (detalhes do agendamento)
- Botões de ação (editar, excluir, enviar agora) aparecem na barra inferior do card expandido
- Botão "Editar" abre o formulário como **Dialog separado** (popup centralizado na tela)
- Filtro de dia da semana na aba "Semanal" (botões Dom-Sáb para filtrar mensagens)

#### 2. `GroupScheduledMessageForm.tsx` — Converter para Dialog
- Envolver todo o formulário em um `<Dialog>` próprio com `open`/`onOpenChange`
- Manter o layout grid atual (form + WhatsApp preview) dentro do DialogContent
- Props mudam: recebe `open`, `onOpenChange` em vez de `onCancel`

#### 3. Interface do `GroupMessagesDialog`
- Remover `showForm` e `editMsg` do estado local do dialog principal
- Adicionar `formOpen`, `editingMsg`, `formScheduleType` como estado
- Adicionar `weekdayFilter` para a aba semanal
- O `handleEdit` seta `editingMsg` e abre o form dialog
- O `handleAdd` limpa `editingMsg` e abre o form dialog

### Arquivos alterados
- `src/components/grupos/GroupMessagesDialog.tsx` — redesign completo dos cards
- `src/components/grupos/GroupScheduledMessageForm.tsx` — envolver em Dialog

### Resultado esperado
- Cards expansíveis com conteúdo completo visível
- Formulário de edição/criação abre como popup na tela
- Filtro por dia da semana na aba Semanal
- Layout contido e responsivo, sem overflow

