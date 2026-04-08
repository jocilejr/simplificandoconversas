

# Reestruturar Campanhas — Separar Criação de Programação

## Conceito

Atualmente o `GroupCampaignDialog` mistura criação da campanha com editor de mensagens. O novo fluxo separa em dois momentos:

1. **Criar Campanha** (dialog simples): Nome, Descrição, Instância, Grupos-alvo — salva
2. **Programação** (botão no card da campanha): Abre modal dedicado com abas por tipo de agendamento (Único, Diário, Semanal, Mensal, Avançado), onde se cria/edita mensagens agendadas individualmente

Replica exatamente o padrão do `whats-grupos`: `CampaignDialog` + `CampaignMessagesDialog` + `ScheduledMessageForm`.

---

## Fluxo do usuário

```text
Aba Campanhas
  → "Nova Campanha" → Dialog (Nome, Instância, Grupos) → Salvar
  → Card da campanha com botões:
      [Programação] [Editar] [▶ Enviar] [🗑 Excluir]
  → "Programação" → Modal com abas:
      [Único] [Diário] [Semanal] [Mensal] [Avançado]
      → Cada aba: lista de mensagens + "Adicionar Mensagem"
      → Form: tipo (grid de ícones), conteúdo, horário → Salvar
```

---

## Alterações técnicas

### 1. `GroupCampaignDialog.tsx` — Simplificar
Remover `GroupMessageEditor`, state `messages`, e a seção de mensagens. Manter apenas Nome, Instância, Descrição, Grupos-alvo.

### 2. `GroupCampaignsTab.tsx` — Botão "Programação"
Adicionar botão `CalendarClock` no card de cada campanha. Ao clicar abre o novo `GroupMessagesDialog`.

### 3. CRIAR `GroupMessagesDialog.tsx` — Modal de Programação
- Abas: **Único**, **Diário**, **Semanal**, **Mensal**, **Avançado**
- Cada aba: header com descrição, botão "Adicionar Mensagem", lista de mensagens filtradas
- Aba Semanal: filtro por dia da semana (Dom-Sáb)
- Cada mensagem: ícone do tipo, preview, horário, Switch ativo/inativo, Editar/Excluir
- Usa `useGroupScheduledMessages(campaignId)`

### 4. CRIAR `GroupScheduledMessageForm.tsx` — Form de Mensagem
Baseado no `ScheduledMessageForm` do whats-grupos:
- Grid de tipos com ícones (Texto, Imagem, Vídeo, Áudio, Documento, Figurinha, Localização, Contato, Enquete, Lista)
- Campos dinâmicos por tipo
- Agendamento por tipo: Calendário+hora (único), hora (diário), dias da semana+hora (semanal), dia do mês+hora (mensal), dias personalizados+hora (avançado)
- Opções: mentionAll, linkPreview
- Cálculo automático de `next_run_at` (BRT)

### 5. CRIAR `useGroupScheduledMessages.ts` — Hook
- Query: `GET /campaigns/:id/messages`
- Mutations: criar, editar, excluir, toggle ativo

### 6. Backend `groups-api.ts` — 5 novas rotas
- `GET /campaigns/:id/messages`
- `POST /campaigns/:id/messages`
- `PUT /campaigns/:id/messages/:msgId`
- `DELETE /campaigns/:id/messages/:msgId`
- `PATCH /campaigns/:id/messages/:msgId/toggle`

### 7. Remover `GroupMessageEditor.tsx`

### 8. `useGroupCampaigns.ts` — Remover `messages` do payload de criação

---

## Arquivos

**Criados:** `GroupMessagesDialog.tsx`, `GroupScheduledMessageForm.tsx`, `useGroupScheduledMessages.ts`
**Alterados:** `GroupCampaignDialog.tsx`, `GroupCampaignsTab.tsx`, `groups-api.ts`, `useGroupCampaigns.ts`
**Removidos:** `GroupMessageEditor.tsx`

