

## Correções: Filtro de dia da semana + Exibição de horário/dia

### Problema 1 — Falta o filtro por dia da semana na aba "Semanal"
O repo de referência tem uma barra de filtro com botões "Todos | Dom | Seg | Ter | Qua | Qui | Sex | Sáb" que aparece apenas na aba Semanal. Clicar em um dia filtra as mensagens que rodam naquele dia. Isso não existe no código atual.

### Problema 2 — Horário e dias não aparecem corretamente nos cards
O `getTimeLabel` para mensagens semanais retorna `msg.content?.time` mas não exibe de forma proeminente. No repo de referência, o horário aparece como um badge destacado antes do ícone de tipo, e os dias da semana aparecem como pills compactas.

### Alterações em `src/components/grupos/GroupMessagesDialog.tsx`

1. **Adicionar estado `weekdayFilter`**: `useState<number | null>(null)` — resetar ao trocar de aba.

2. **Renderizar barra de filtro na aba "weekly"**: Entre o subheader (descrição + botão Adicionar) e a lista de mensagens, adicionar uma row de botões:
   - Botão "Todos" (ativo quando `weekdayFilter === null`)
   - 7 botões Dom-Sáb (ativo quando `weekdayFilter === d.value`)
   - Estilo: `px-2.5 py-1 rounded-md text-[11px] font-medium border`, com `border-primary bg-primary/10 text-primary` quando ativo

3. **Filtrar mensagens por dia**: Na aba weekly, depois de filtrar por `schedule_type`, aplicar filtro adicional:
   ```typescript
   let displayMessages = tabMessages;
   if (tab.value === "weekly" && weekdayFilter != null) {
     displayMessages = tabMessages.filter((m: any) => 
       (m.content?.weekdays || []).includes(weekdayFilter)
     );
   }
   ```

4. **Melhorar exibição do horário no card**: Trocar o span de horário por um badge mais proeminente, similar ao repo de referência — badge com fundo `bg-primary/10` e texto `text-primary` mostrando o horário.

5. **Resetar filtro ao trocar aba**: No `onValueChange` do Tabs, adicionar `setWeekdayFilter(null)`.

### Arquivo alterado
- `src/components/grupos/GroupMessagesDialog.tsx`

