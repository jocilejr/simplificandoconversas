

## Remoção total do módulo de Grupos

### Escopo
Remover 100% do código, rotas, hooks, páginas, componentes, tabelas e arquivos relacionados ao módulo de Grupos do WhatsApp.

### Frontend (deletar)

**Páginas:**
- `src/pages/GruposPage.tsx`
- `src/pages/SmartLinkRedirect.tsx`

**Componentes (`src/components/grupos/`):**
- `GroupCampaignDialog.tsx`
- `GroupCampaignsTab.tsx`
- `GroupDashboardTab.tsx`
- `GroupImportDialog.tsx`
- `GroupMessagesDialog.tsx`
- `GroupQueueTab.tsx`
- `GroupScheduledMessageForm.tsx`
- `GroupSmartLinkTab.tsx`
- `SchedulerDebugPanel.tsx`
- `WhatsAppPreview.tsx`
- `src/components/chatbot/GroupNode.tsx`

**Hooks (`src/hooks/`):**
- `useGroupCampaigns.ts`
- `useGroupEvents.ts`
- `useGroupEventsLive.ts`
- `useGroupQueue.ts`
- `useGroupScheduledMessages.ts`
- `useGroupSmartLinks.ts`

**Edits em arquivos compartilhados:**
- `src/App.tsx` — remover import + rota `/grupos` e `/r/g/:slug`
- `src/components/AppSidebar.tsx` — remover item "Grupos" do menu
- `src/components/chatbot/NodePalette.tsx` — remover entrada GroupNode (se houver)
- `src/components/chatbot/FlowEditor.tsx` — remover registro do nodeType `group` (se houver)
- `src/types/chatbot.ts` — remover tipos relacionados a group node
- Tirar permissão `grupos` de `PermissionGate` se for específica

### Backend (deletar)

- `deploy/backend/src/routes/groups-api.ts`
- `deploy/backend/src/routes/groups-webhook.ts`
- `deploy/backend/src/lib/group-scheduler.ts`

**Edits:**
- `deploy/backend/src/index.ts` — remover registro das rotas/webhooks/scheduler de grupos
- `deploy/nginx/default.conf.template` — remover bloco `location /r/g/`

### Banco de dados (migration DROP)

```sql
DROP TABLE IF EXISTS public.group_message_queue CASCADE;
DROP TABLE IF EXISTS public.group_scheduled_messages CASCADE;
DROP TABLE IF EXISTS public.group_campaigns CASCADE;
DROP TABLE IF EXISTS public.group_events CASCADE;
DROP TABLE IF EXISTS public.group_smart_links CASCADE;
DROP TABLE IF EXISTS public.group_smart_link_clicks CASCADE;
DROP TABLE IF EXISTS public.group_links CASCADE;
DROP TABLE IF EXISTS public.group_selected CASCADE;
DROP TABLE IF EXISTS public.group_spam_config CASCADE;
DROP TABLE IF EXISTS public.group_backups CASCADE;
NOTIFY pgrst, 'reload schema';
```
(Lista exata será confirmada lendo `init-db.sql` e `migrate-workspace.sql` antes de executar.)

### Memórias a limpar (`mem://`)

Remover do `index.md` e deletar arquivos:
- `mem://features/whatsapp-groups/smart-link-system`
- `mem://features/whatsapp-groups/campaign-media-hygiene`
- `mem://features/whatsapp-groups/automation-anti-spam`
- `mem://features/whatsapp-groups/scheduler-logic`
- `mem://features/whatsapp-groups/backup-import-v2`
- `mem://features/whatsapp-groups/queue-and-deduplication-v2`
- `mem://tech/whatsapp-groups/real-time-validation`
- `mem://tech/whatsapp-groups/data-mapping-compatibility-v2`

### Validação na VPS após deploy

```bash
cd ~/simplificandoconversas && git pull && bash deploy/update.sh

source deploy/.env
docker exec deploy-postgres-1 psql -U postgres -d postgres -c \
"SELECT table_name FROM information_schema.tables 
 WHERE table_schema='public' AND table_name LIKE 'group_%';"
```
Resultado esperado: 0 linhas.

### Risco
Baixo. Módulo isolado, sem dependências críticas em outras áreas. Ação irreversível — recomendado backup do banco antes (`pg_dump`).

### Pendências antes de executar
1. Confirmar se quero também remover a coluna `permissions->grupos` dos workspaces existentes
2. Confirmar se posso deletar definitivamente a tabela `group_backups` (pode ter mídias importadas)

