

## Fix: Campo de horário e dias da semana não reconhecidos

### Causa raiz
O backup original usa **camelCase** nos campos JSON:
- `runTime` (não `time`)
- `weekDays` (não `weekdays`)
- `monthDay` está correto

O código atual lê `msg.content?.time` e `msg.content?.weekdays` — que não existem no JSON.

### Solução
Não é necessário reimportar. Basta corrigir as referências no código para aceitar ambos os formatos (camelCase do backup e lowercase que o formulário pode usar).

### Alterações em `src/components/grupos/GroupMessagesDialog.tsx`

1. **`getTimeLabel`**: Trocar `msg.content?.time` por `msg.content?.runTime || msg.content?.time`
2. **`getScheduleDetail`**: Mesma correção em todas as referências a `time` e `weekdays`
3. **Filtro semanal**: Trocar `msg.content?.weekdays` por `msg.content?.weekDays || msg.content?.weekdays` em todos os lugares (filtro e pills)
4. **Pills de dias**: Mesma correção na renderização dos badges de dias

Locais exatos a alterar (6 ocorrências):
- Linha 71: `msg.content?.time` → `msg.content?.runTime || msg.content?.time`
- Linha 76: idem
- Linha 78: `msg.content?.weekdays` → `msg.content?.weekDays || msg.content?.weekdays`
- Linha 79: `msg.content?.time` → idem
- Linha 81-82: idem para `time`
- Linha 143: filtro weekday → mesma correção
- Linha 214-216: pills weekday → mesma correção

### Arquivo alterado
- `src/components/grupos/GroupMessagesDialog.tsx`

