

## Plano: Reconstruir do zero — manter apenas o frontend base

Isso é uma operação grande. Vou detalhar tudo que será removido e o que ficará.

### O que será REMOVIDO

**Edge Functions (4 arquivos):**
- `supabase/functions/check-timeouts/index.ts`
- `supabase/functions/evolution-proxy/index.ts`
- `supabase/functions/execute-flow/index.ts`
- `supabase/functions/link-redirect/index.ts`

**Config das functions** em `supabase/config.toml` — limpar todas as entradas de functions

**Deploy (pasta inteira):**
- `deploy/` — backend Express, Baileys service, Docker compose, Nginx, scripts

**Tabelas do banco (via migration DROP):**
- `chatbot_flow_history`, `chatbot_flows`, `contact_photos`, `contact_tags`
- `conversation_labels`, `conversations`, `evolution_instances`
- `flow_executions`, `flow_timeouts`, `labels`, `messages`
- `profiles`, `quick_replies`, `tracked_links`
- Functions DB: `handle_new_user`, `update_updated_at_column`, `increment_unread`
- Storage bucket: `chatbot-media`

**Páginas específicas do sistema antigo:**
- `ChatbotBuilder.tsx`, `Contacts.tsx`, `Conversations.tsx`, `Schedule.tsx`, `LinkRedirect.tsx`, `SettingsPage.tsx`, `Dashboard.tsx`

**Componentes do sistema antigo:**
- `src/components/chatbot/` (inteira)
- `src/components/conversations/` (inteira)
- `src/components/settings/` (inteira)
- `ManualFlowTrigger.tsx`

**Hooks do sistema antigo:**
- `useChatbotFlows.ts`, `useContactPhoto.ts`, `useConversations.ts`, `useFlowExecutions.ts`, `useFlowHistory.ts`, `useLabels.ts`, `useMessages.ts`, `useProfile.ts`, `useQuickReplies.ts`, `useWhatsAppInstances.ts`

**Tipos:**
- `src/types/chatbot.ts`

### O que FICARÁ

- **Infraestrutura React**: `App.tsx` (simplificado), `main.tsx`, `index.css`, `App.css`
- **UI components**: Toda a pasta `src/components/ui/` (shadcn)
- **Base components**: `AppLayout.tsx`, `AppSidebar.tsx`, `NavLink.tsx`, `ProtectedRoute.tsx`, `ThemeToggle.tsx`
- **Hooks base**: `use-mobile.tsx`, `use-toast.ts`, `useAuth.ts`
- **Auth page**: `Auth.tsx`
- **Página inicial**: `Index.tsx` (vazia/placeholder)
- **NotFound**: `NotFound.tsx`
- **Config**: `package.json`, `vite.config.ts`, `tailwind.config.ts`, etc.
- **Supabase client**: `src/integrations/supabase/client.ts` (auto-gerado)

### Resumo da execução

1. **Migration SQL**: DROP todas as 14 tabelas, 3 functions DB, e o bucket
2. **Deletar** as 4 edge functions e a pasta `deploy/`
3. **Deletar** páginas, componentes, hooks e tipos do sistema antigo
4. **Simplificar** `App.tsx` para ter apenas Auth, uma página inicial vazia e NotFound
5. **Limpar** `AppSidebar.tsx` removendo links para páginas deletadas
6. **Limpar** `supabase/config.toml` removendo as entradas de functions

Após isso, o projeto será um shell React limpo com autenticação, pronto para reconstrução.

