
# Reestruturar Campanhas — Separar Criação de Programação

## Conceito

Atualmente o GroupCampaignDialog mistura criação da campanha com editor de mensagens. O novo fluxo separa em dois momentos:

1. **Criar Campanha** (dialog simples): Nome, Descrição, Instância, Grupos-alvo → salva
2. **Programação** (botão no card da campanha): Abre modal dedicado com abas por tipo de agendamento (Único, Diário, Semanal, Mensal, Avançado), onde se cria/edita mensagens agendadas individualmente

Isso replica exatamente o padrão do `whats-grupos` com `CampaignDialog` + `CampaignMessagesDialog` + `ScheduledMessageForm`.

---

## Arquivos alterados/criados

### 1. `src/components/grupos/GroupCampaignDialog.tsx` — Simplificar
- Remover a seção de mensagens (`GroupMessageEditor`)
- Manter apenas: Nome, Instância, Descrição, Grupos-alvo
- Dialog compacto e focado

### 2. `src/components/grupos/GroupCampaignsTab.tsx` — Adicionar botão "Programação"
- No card de cada campanha, adicionar botão **"Programação"** (ícone CalendarClock)
- Ao clicar, abre o novo `GroupMessagesDialog`
- Manter botões existentes (Editar, Play, Excluir)

### 3. **CRIAR** `src/components/grupos/GroupMessagesDialog.tsx` — Modal de Programação
Baseado no `CampaignMessagesDialog` do whats-grupos:
- Abas: **Único**, **Diário**, **Semanal**, **Mensal**, **Avançado**
- Cada aba mostra lista de mensagens daquele tipo + botão "Adicionar Mensagem"
- Aba Semanal tem filtro por dia da semana (Dom-Sáb)
- Cada mensagem na lista mostra: tipo (ícone), preview do conteúdo, horário, Switch ativo/inativo, botões Editar/Excluir
- Ao clicar Adicionar ou Editar, abre o `GroupScheduledMessageForm`

### 4. **CRIAR** `src/components/grupos/GroupScheduledMessageForm.tsx` — Form de Mensagem
Baseado no `ScheduledMessageForm` do whats-grupos:
- Grid de tipos de mensagem com ícones (Texto, Imagem, Vídeo, Áudio, Documento, Figurinha, Localização, Contato, Enquete, Lista)
- Campos dinâmicos por tipo (texto→textarea, mídia→URL+legenda, contato→nome+tel, enquete→pergunta+opções, etc.)
- Seção de agendamento dinâmica por scheduleType:
  - **Único**: Calendário + hora
  - **Diário**: Apenas hora
  - **Semanal**: Seletor de dias (Dom-Sáb) + hora
  - **Mensal**: Dia do mês + hora
  - **Avançado**: Dias do mês personalizados + hora
- Opções extras: mentionAll (marcar todos), linkPreview
- Calcula `next_run_at` automaticamente (com timezone BRT)
- Salva direto na tabela `group_scheduled_messages` via API

### 5. `src/components/grupos/GroupMessageEditor.tsx` — Remover
- Não mais necessário (substituído pelo novo fluxo)
- Remover arquivo

### 6. `src/hooks/useGroupCampaigns.ts` — Adicionar queries de mensagens
- Adicionar `useGroupScheduledMessages(campaignId)` — lista mensagens de uma campanha
- Adicionar mutations: criar/editar/excluir mensagem agendada, toggle ativo
- Ou criar hook separado `useGroupScheduledMessages.ts`

### 7. Backend `deploy/backend/src/routes/groups-api.ts` — Rotas de mensagens
- `GET /campaigns/:id/messages` — Lista mensagens agendadas da campanha
- `POST /campaigns/:id/messages` — Cria mensagem agendada
- `PUT /campaigns/:id/messages/:msgId` — Atualiza mensagem
- `DELETE /campaigns/:id/messages/:msgId` — Remove mensagem
- `PATCH /campaigns/:id/messages/:msgId/toggle` — Toggle ativo/inativo

---

## Fluxo do usuário

```text
Aba Campanhas
  → "Nova Campanha" → Dialog (Nome, Instância, Grupos) → Salvar
  → Card da campanha aparece com botões:
      [Programação] [Editar] [▶ Enviar] [🗑 Excluir]
  → Clicar "Programação" → Modal com abas:
      [Único] [Diário] [Semanal] [Mensal] [Avançado]
      Cada aba: lista de mensagens + "Adicionar Mensagem"
      → Clicar "Adicionar" → Form: tipo, conteúdo, horário → Salvar
```

## Arquivos finais

**Criados:**
1. `src/components/grupos/GroupMessagesDialog.tsx`
2. `src/components/grupos/GroupScheduledMessageForm.tsx`
3. `src/hooks/useGroupScheduledMessages.ts`

**Alterados:**
4. `src/components/grupos/GroupCampaignDialog.tsx` — remover seção de mensagens
5. `src/components/grupos/GroupCampaignsTab.tsx` — adicionar botão "Programação"
6. `deploy/backend/src/routes/groups-api.ts` — rotas CRUD de mensagens agendadas

**Removidos:**
7. `src/components/grupos/GroupMessageEditor.tsx`
