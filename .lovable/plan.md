

# Correção: Edição de mensagens agendadas não carrega dados salvos

## Problema identificado

Quando você clica em "Editar" numa mensagem agendada, o formulário não restaura corretamente todos os valores salvos. Isso acontece por dois motivos:

1. **Conflito de chaves JSON**: Mensagens importadas usam `weekDays` (camelCase) e `runTime`, mas o formulário de edição só verifica `weekdays` (lowercase) na linha 121. Se a chave não bate, cai no fallback que mantém o padrão `[1,2,3,4,5]`.

2. **`scheduleType` vem da aba ativa, não da mensagem**: O formulário recebe `scheduleType={activeTab}` em vez de usar o `schedule_type` real da mensagem sendo editada. Se por algum motivo não bater, o formulário exibe campos de agendamento errados.

## Correção

### Arquivo: `src/components/grupos/GroupScheduledMessageForm.tsx`

- **Linha 121**: Verificar tanto `weekdays` quanto `weekDays` (camelCase)
  ```
  setWeekdays(editData.content.weekdays || editData.content.weekDays)
  ```

### Arquivo: `src/components/grupos/GroupMessagesDialog.tsx`

- **Linha 347**: Passar o `schedule_type` real da mensagem quando estiver editando, em vez de `activeTab`
  ```
  scheduleType={editingMsg?.schedule_type || activeTab}
  ```

## Resultado esperado

Ao clicar em "Editar", o formulário carregará exatamente o horário, dias da semana, tipo de frequência e todas as opções que foram salvas originalmente na mensagem.

