

# Sistema de Grupos WhatsApp — Plano Revisado

## Mudanca principal

Sem instancias exclusivas. O modulo de Grupos reutiliza as instancias ja existentes em `whatsapp_instances` do workspace. O usuario seleciona qual instancia usar para buscar grupos e enviar campanhas.

---

## Fase 1: Fundacao

### 1. Tabelas (migration SQL na VPS via `init-db.sql`)

5 tabelas novas com `workspace_id` e RLS padrao:

```text
group_selected          — Grupos selecionados para monitoramento
  id, workspace_id, user_id, instance_name, group_jid,
  group_name, member_count, created_at

group_campaigns         — Campanhas de mensagens para grupos
  id, workspace_id, user_id, name, description,
  instance_name (text, referencia whatsapp_instances),
  group_jids text[], is_active, created_at, updated_at

group_scheduled_messages — Mensagens agendadas vinculadas a campanhas
  id, workspace_id, user_id, campaign_id (FK group_campaigns),
  message_type (text/image/video/audio/document),
  content jsonb, schedule_type (once/interval/daily/weekly/cron),
  cron_expression, interval_minutes, scheduled_at,
  next_run_at, last_run_at, is_active, created_at, updated_at

group_message_queue     — Fila exclusiva de envio para grupos
  id, workspace_id, user_id, campaign_id, scheduled_message_id,
  group_jid, group_name, instance_name, message_type, content jsonb,
  status (pending/processing/sent/failed/cancelled),
  error_message, priority, execution_batch,
  created_at, started_at, completed_at

group_participant_events — Eventos join/leave em tempo real
  id, workspace_id, user_id, instance_name, group_jid,
  group_name, participant_jid, action (add/remove/promote/demote),
  created_at
```

RLS padrao: `ws_select` com `is_workspace_member`, `ws_insert`/`ws_update` com `can_write_workspace`, `ws_delete` com `has_workspace_role(admin)`.

### 2. Backend — Novas rotas

**`deploy/backend/src/routes/groups-api.ts`** montada em `/api/groups/`:

- `POST /fetch-groups` — Recebe `{ instanceName, workspaceId }`, chama Evolution API `GET /group/fetchAllGroups/{instance}`, retorna lista de grupos com nome, jid e member count
- `POST /select-groups` — Salva grupos selecionados em `group_selected`
- `GET /selected-groups` — Lista grupos selecionados do workspace
- `DELETE /selected-groups/:id` — Remove grupo do monitoramento
- `POST /campaigns` — CRUD de campanhas
- `GET /campaigns` — Lista campanhas
- `PUT /campaigns/:id` — Atualiza campanha
- `DELETE /campaigns/:id` — Remove campanha
- `POST /campaigns/:id/enqueue` — Gera itens na fila a partir de campanha
- `GET /queue-status` — Status da fila de grupos
- `POST /queue/process` — Processa fila (envio real via Evolution API `sendText`/`sendMedia` para JIDs de grupo)
- `POST /queue/cancel-batch` — Cancela batch

**`deploy/backend/src/routes/groups-webhook.ts`** em `/api/groups/webhook`:

- Recebe eventos `group-participants.update` do Evolution e persiste em `group_participant_events`

**`deploy/backend/src/index.ts`** — Registrar as 2 novas rotas.

### 3. Frontend — Pagina com 4 abas

**`src/pages/GruposPage.tsx`** — Reescrita completa com Tabs:

**Aba 1: Dashboard**
- Cards: Total de grupos monitorados, Total de membros, Campanhas ativas, Mensagens enviadas hoje
- Tabela dos grupos selecionados com member count
- Eventos recentes (entradas/saidas)

**Aba 2: Grupos**
- Seletor de instancia (dropdown com instancias existentes do workspace via `useWhatsAppInstances`)
- Botao "Buscar Grupos" — chama `/api/groups/fetch-groups`
- Lista de grupos retornados com checkbox para selecionar
- Botao "Adicionar Selecionados" — salva em `group_selected`
- Lista dos grupos ja adicionados com opcao de remover

**Aba 3: Campanhas**
- CRUD de campanhas
- Seletor de instancia (mesmo dropdown)
- Seletor de grupos-alvo (dos grupos ja selecionados)
- Editor de mensagens (texto, imagem, video, audio, documento)
- Agendamento: unico, intervalo, diario, semanal, cron
- Toggle ativar/desativar
- Botao "Enviar Agora" / "Agendar"

**Aba 4: Fila**
- Tabela com status (pending/processing/sent/failed)
- Filtros por campanha, status
- Acoes: cancelar batch, reprocessar falhas
- Configuracao de delay entre envios

### 4. Hooks React

- `useGroupSelected` — CRUD de grupos selecionados + fetch da Evolution
- `useGroupCampaigns` — CRUD de campanhas e mensagens agendadas
- `useGroupQueue` — Status e acoes da fila
- `useGroupEvents` — Eventos de participantes

### 5. Componentes

```text
src/components/grupos/
  GroupDashboardTab.tsx
  GroupSelectorTab.tsx      — busca e seleciona grupos de instancias existentes
  GroupCampaignsTab.tsx
  GroupQueueTab.tsx
  GroupCampaignDialog.tsx
  GroupMessageEditor.tsx
```

---

## Arquivos criados/alterados

**Criados:**
1. `deploy/backend/src/routes/groups-api.ts`
2. `deploy/backend/src/routes/groups-webhook.ts`
3. `src/hooks/useGroupSelected.ts`
4. `src/hooks/useGroupCampaigns.ts`
5. `src/hooks/useGroupQueue.ts`
6. `src/hooks/useGroupEvents.ts`
7. `src/components/grupos/GroupDashboardTab.tsx`
8. `src/components/grupos/GroupSelectorTab.tsx`
9. `src/components/grupos/GroupCampaignsTab.tsx`
10. `src/components/grupos/GroupQueueTab.tsx`
11. `src/components/grupos/GroupCampaignDialog.tsx`
12. `src/components/grupos/GroupMessageEditor.tsx`

**Alterados:**
1. `src/pages/GruposPage.tsx` — Reescrita completa
2. `deploy/backend/src/index.ts` — Registrar novas rotas
3. `deploy/init-db.sql` — Adicionar tabelas

## Diferenca do plano anterior

- Sem tabela `group_instances` — reutiliza `whatsapp_instances` existente
- Sem CRUD de instancias exclusivas — apenas um dropdown seletor
- Hook `useWhatsAppInstances` ja existente e reutilizado no frontend
- Backend valida que a instancia pertence ao workspace antes de qualquer operacao

