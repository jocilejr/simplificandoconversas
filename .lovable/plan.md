

## Plano: Conexao Evolution API + Chat de Conversas Funcional

### Visao Geral

Tornar funcional o salvamento das credenciais da Evolution API nas configuracoes e construir o chat de conversas em tempo real com envio/recebimento de mensagens via Evolution API.

---

### 1. Banco de Dados — Novas Tabelas

**`conversations`** — armazena cada conversa (1 por contato)
- `id`, `user_id` (dono), `remote_jid` (numero WhatsApp), `contact_name`, `last_message`, `last_message_at`, `unread_count`, `created_at`

**`messages`** — armazena mensagens enviadas e recebidas
- `id`, `conversation_id` (FK), `user_id`, `remote_jid`, `content`, `message_type` (text/image/audio/video), `direction` (inbound/outbound), `status` (sent/delivered/read), `external_id`, `media_url`, `created_at`

RLS: usuario so ve suas proprias conversas e mensagens. Realtime habilitado em ambas as tabelas.

---

### 2. Edge Functions

**`evolution-proxy`** — proxy seguro para a Evolution API
- Recebe requests do frontend, busca credenciais do usuario na tabela `profiles`, e faz o request para a Evolution API
- Endpoints: `test-connection`, `send-message`, `fetch-chats`
- Evita expor credenciais no frontend

**`evolution-webhook`** — recebe mensagens do WhatsApp
- Endpoint publico (sem JWT) que a Evolution API chama quando chega mensagem
- Salva a mensagem na tabela `messages` e atualiza `conversations`
- Requer `verify_jwt = false` no config.toml

---

### 3. Settings Page — Funcional

- Carregar credenciais do perfil ao montar (query `profiles` com `useQuery`)
- Salvar credenciais no perfil (mutation `update profiles`)
- Botao "Testar Conexao" chama `evolution-proxy` com action `test-connection`
- Feedback visual: loading states, toast de sucesso/erro
- Carregar e salvar nome do perfil tambem

---

### 4. Conversations Page — Chat Funcional

**Painel esquerdo (lista de conversas):**
- Query `conversations` ordenado por `last_message_at` desc
- Busca por nome/numero
- Badge de unread count
- Realtime subscription para atualizar lista automaticamente

**Painel direito (chat ativo):**
- Query `messages` da conversa selecionada, ordenado por `created_at`
- Layout estilo WhatsApp: bolhas verdes (outbound) e brancas (inbound)
- Input de texto + botao enviar
- Enviar chama `evolution-proxy` com action `send-message`
- Realtime subscription para novas mensagens
- Scroll automatico para ultima mensagem
- Marcar como lido ao abrir conversa

---

### Arquivos a Criar/Editar

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar tabelas `conversations` e `messages` + RLS + realtime |
| `supabase/functions/evolution-proxy/index.ts` | Criar edge function proxy |
| `supabase/functions/evolution-webhook/index.ts` | Criar edge function webhook |
| `supabase/config.toml` | NAO editar (auto-gerenciado) |
| `src/pages/SettingsPage.tsx` | Refatorar com load/save/test funcional |
| `src/pages/Conversations.tsx` | Reescrever com chat completo |
| `src/hooks/useProfile.ts` | Hook para carregar/atualizar perfil |
| `src/hooks/useConversations.ts` | Hook para conversas + realtime |
| `src/hooks/useMessages.ts` | Hook para mensagens + realtime + envio |

