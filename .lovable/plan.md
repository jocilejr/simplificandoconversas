
Objetivo: corrigir a origem do problema de dados vazios no módulo de grupos da VPS.

Diagnóstico confirmado
- As tabelas `public.group_selected` e `public.group_participant_events` existem na VPS.
- Ambas estão vazias.
- Portanto, o problema não é “falta de tabela” nem `workspace_id` desalinhado nos registros atuais; o problema é que nenhum registro está sendo criado.
- No código, a tela `/grupos` mostra:
  - `GroupDashboardTab`
  - `GroupCampaignsTab`
  - `GroupQueueTab`
  - `GroupSmartLinkTab`
- Mas o componente que realmente popula `group_selected` é `GroupSelectorTab`, e ele não está montado em `src/pages/GruposPage.tsx`.
- Resultado: hoje não existe fluxo visível na UI dessa página para salvar grupos monitorados.
- Os “Eventos Recentes” dependem de `group_participant_events`, que por sua vez só faz sentido depois que houver grupos monitorados e webhook de grupos chegando no backend.

O que vou implementar
1. Recolocar a seleção de grupos na UI
- Adicionar uma nova aba em `/grupos` para montar `GroupSelectorTab`.
- Isso vai permitir buscar grupos da instância e persistir em `group_selected`.

2. Ajustar o hook para usar o backend da VPS de forma consistente
- Revisar `useGroupSelected` para evitar depender apenas de leitura direta da tabela quando o fluxo principal de gravação já acontece via backend.
- Manter invalidação e refresh corretos após adicionar/remover grupos.

3. Melhorar a visão geral quando não houver dados
- Em `GroupDashboardTab`, trocar estados “vazios” genéricos por mensagens orientando:
  - que ainda não existem grupos monitorados
  - que é preciso adicionar grupos na nova aba
  - que eventos só aparecem depois disso

4. Validar a origem dos eventos de grupos
- Revisar a integração do backend em `deploy/backend/src/routes/groups-webhook.ts`.
- Confirmar no plano de correção o endpoint esperado para a VPS: `/api/groups/webhook/events`.
- Se necessário na próxima etapa de execução, preparar instruções objetivas para você validar no Evolution da VPS se esse webhook está configurado.

5. Se necessário, adicionar sincronização inicial de contagem
- Caso o usuário já consiga buscar grupos, garantir que `member_count` inicial vindo de `fetch-groups` seja a fonte exibida na dashboard, mesmo antes de eventos em tempo real.

Arquivos envolvidos
- `src/pages/GruposPage.tsx`
- `src/components/grupos/GroupSelectorTab.tsx`
- `src/hooks/useGroupSelected.ts`
- `src/components/grupos/GroupDashboardTab.tsx`
- `deploy/backend/src/routes/groups-api.ts`
- `deploy/backend/src/routes/groups-webhook.ts`

Resultado esperado
- A aba de grupos permitirá finalmente popular `group_selected`.
- “Grupos monitorados” e “membros do grupo” passarão a aparecer assim que você adicionar os grupos.
- “Eventos recentes” passarão a preencher quando o webhook de grupos da VPS estiver chegando corretamente.

Detalhe técnico importante
- Hoje o backend já possui:
  - `POST /api/groups/fetch-groups`
  - `POST /api/groups/select-groups`
  - `GET /api/groups/selected-groups`
  - `DELETE /api/groups/selected-groups/:id`
  - `POST /api/groups/webhook/events`
- O gargalo principal é de produto/UI: a página `/grupos` não expõe `GroupSelectorTab`, então `group_selected` nunca é alimentada pela interface.
- Como as tabelas estão vazias, não faz sentido criar novas tables agora.

Após aprovação, eu implemento a aba de seleção e deixo o fluxo completo coerente com a VPS.
