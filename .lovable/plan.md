
# Reestruturar Campanhas — Separar Criação de Programação

## Conceito

O GroupCampaignDialog deve conter APENAS: Nome, Descrição, Instância, Grupos-alvo (sem editor de mensagens).
O botão "Programação" no card da campanha abre um modal dedicado (GroupMessagesDialog) com abas por tipo de agendamento.
Dentro dele, um form (GroupScheduledMessageForm) para criar/editar mensagens individualmente.

## Arquivos

### 1. `src/components/grupos/GroupCampaignDialog.tsx` — Simplificar
- Remover import e uso de `GroupMessageEditor`
- Remover state `messages` e a seção de mensagens
- Manter apenas: Nome, Instância, Descrição, Grupos-alvo

### 2. `src/components/grupos/GroupCampaignsTab.tsx` — Adicionar botão "Programação"
- Importar `CalendarClock` e `GroupMessagesDialog`
- Adicionar state `messagesDialogCampaign`
- No card, adicionar botão com ícone CalendarClock e tooltip "Programação"
- Renderizar `GroupMessagesDialog` passando a campanha selecionada

### 3. CRIAR `src/components/grupos/GroupMessagesDialog.tsx`
Modal com abas: Único, Diário, Semanal, Mensal, Avançado
- Usa `useGroupScheduledMessages(campaign.id)`
- Cada aba filtra mensagens por `schedule_type` (once/daily/weekly/monthly/custom)
- Cada aba tem header com descrição + botão "Adicionar Mensagem"
- Aba Semanal tem filtro por dia da semana (Dom-Sáb)
- Lista de mensagens com: ícone do tipo, preview do conteúdo, horário, Switch ativo/inativo, botões Editar/Excluir
- Ao clicar Adicionar/Editar, abre GroupScheduledMessageForm

### 4. CRIAR `src/components/grupos/GroupScheduledMessageForm.tsx`
Form completo baseado no ScheduledMessageForm do whats-grupos:
- Grid de tipos: Texto, Imagem, Vídeo, Áudio, Documento, Figurinha, Localização, Contato, Enquete, Lista
- Campos dinâmicos por tipo
- Seção de agendamento por scheduleType:
  - Único: Calendário + hora
  - Diário: Apenas hora
  - Semanal: Seletor de dias (Dom-Sáb) + hora
  - Mensal: Dia do mês + hora
  - Avançado: Dias personalizados + hora
- Opções: mentionAll, linkPreview
- Calcula next_run_at (timezone BRT)
- Salva via useGroupScheduledMessages

### 5. CRIAR `src/hooks/useGroupScheduledMessages.ts`
- Query: GET /campaigns/:id/messages
- Mutations: create, update, delete, toggle

### 6. REMOVER `src/components/grupos/GroupMessageEditor.tsx`

### 7. Backend `deploy/backend/src/routes/groups-api.ts` — Novas rotas
- GET /campaigns/:id/messages
- POST /campaigns/:id/messages
- PUT /campaigns/:id/messages/:msgId
- DELETE /campaigns/:id/messages/:msgId
- PATCH /campaigns/:id/messages/:msgId/toggle

### 8. `src/hooks/useGroupCampaigns.ts` — Remover `messages` do payload de createCampaign
