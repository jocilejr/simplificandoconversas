
Problema que vou atacar agora:
- A duplicação lógica da aba semanal já foi corrigida, então o bug restante parece ser de layout/overflow.
- O modal de programação está limitando bem a altura, mas não está contendo corretamente a largura. Quando a aba “Semanal” renderiza tabs + cards com textos/URLs maiores, alguns elementos forçam overflow horizontal e a área inteira fica “desalinhada”, dando a sensação de CSS quebrado e impedindo cliques corretos.

Arquivos a revisar/ajustar:
1. `src/components/grupos/GroupMessagesDialog.tsx`
2. `src/components/ui/tabs.tsx`
3. `src/components/grupos/GroupScheduledMessageForm.tsx`

Plano de implementação:
1. Fortalecer a contenção do modal em `GroupMessagesDialog.tsx`
- Adicionar contenção horizontal no `DialogContent` (`overflow-x-hidden`).
- Garantir que `Tabs`, `TabsContent` e a lista de cards usem `w-full`, `min-w-0` e `overflow-hidden` onde necessário.
- Ajustar cada card de mensagem para nunca empurrar a largura do modal: `w-full`, `min-w-0`, `overflow-hidden`.
- No bloco de texto do card, usar truncamento mais seguro para textos longos/URLs (`overflow-hidden`, `truncate`/`line-clamp-1`, `break-all` só se necessário).

2. Corrigir o comportamento visual das abas
- Em `tabs.tsx`, adicionar `min-w-0` no `TabsTrigger` para que tabs dentro de grids/flex não estourem largura.
- Em `GroupMessagesDialog.tsx`, deixar cada trigger ocupar corretamente sua coluna (`w-full`) e reduzir o risco de badges/labels empurrarem o layout.

3. Ajustar a linha superior de cada card
- Permitir quebra/controlar melhor o header do card (`Badge` + horário + indicador “todos”) com `flex-wrap` ou `min-w-0`.
- Evitar que qualquer texto pequeno nessa faixa superior empurre a largura total do card.

4. Ajustar o formulário da aba semanal
- Em `GroupScheduledMessageForm.tsx`, fazer a linha dos dias da semana aceitar wrap se faltar espaço, para o editor semanal também não quebrar o modal ao abrir edição.

Validação que vou considerar obrigatória depois da implementação:
- Abrir `Grupos > Campanhas > Programação > Semanal`.
- Confirmar que não existe mais scroll horizontal no modal.
- Confirmar que os cards ficam contidos dentro da caixa.
- Testar editar, excluir e ativar/desativar uma programação semanal.
- Abrir o formulário semanal e verificar que os botões dos dias também ficam contidos.

Abordagem de menor risco:
- Vou priorizar ajustes locais nesse modal e no componente base de tabs, sem mexer na lógica de agendamento nem no backend.
