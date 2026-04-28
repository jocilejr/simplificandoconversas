
# Chat ao Vivo — Central de Conversas

Nova página `/chat` que consolida todas as conversas de todas as instâncias do workspace em tempo real, com ferramentas de atendimento no painel lateral: etiquetas, notas, lembretes e disparo de fluxos.

## O que o usuário verá

Layout de 3 colunas no padrão inbox (estilo ManyChat/Intercom):

```text
┌─────────────────────────────────────────────────────────────────┐
│  Filtros: [Todas instâncias ▼] [Etiqueta ▼] [🔍 buscar]         │
├──────────────┬────────────────────────────┬────────────────────┤
│ CONVERSAS    │ MENSAGENS                  │ PAINEL CONTATO     │
│              │                            │                    │
│ • João   2   │ ← Oi, bom dia              │ 📞 5588...         │
│   "Oi"  now  │    08:14                   │ Instância: vendas  │
│ • Maria      │                            │                    │
│   "ok"  5m   │ Beleza, pode enviar →      │ 🏷 Etiquetas       │
│ • Pedro      │           08:15 ✓✓         │ [Lead Quente] [x]  │
│              │                            │ + adicionar        │
│              │                            │                    │
│              │                            │ 📝 Notas (3)       │
│              │                            │                    │
│              │                            │ ⏰ Lembretes (1)   │
│              │                            │                    │
│              │                            │ ⚡ Disparar Fluxo   │
│              ├────────────────────────────┤                    │
│              │ [digite...] [📎] [Enviar]  │                    │
└──────────────┴────────────────────────────┴────────────────────┘
```

- **Coluna 1** — lista de conversas ordenadas por `last_message_at`, badge de não lidas, avatar (usa `contact_photos`), filtro por instância e etiqueta, busca por nome/telefone.
- **Coluna 2** — timeline de mensagens (in/out), grupos por dia, indicador de status (✓/✓✓), suporte a imagem/áudio/documento via `media_url`. Campo de envio manual com emoji + anexo de mídia (reutiliza `uploadMedia`).
- **Coluna 3** — painel do contato ativo com abas: Etiquetas, Notas, Lembretes, Ações (Disparar Fluxo, marcar como lida, limpar contador).

Tudo **em tempo real** via Supabase Realtime — a publication `supabase_realtime` já inclui `messages`.

## Tabelas existentes reutilizadas

Nenhuma tabela nova é obrigatória além de **notas** (não existe ainda).

- `conversations` — já tem `remote_jid`, `instance_name`, `contact_name`, `phone_number`, `last_message`, `last_message_at`, `unread_count`, `workspace_id`.
- `messages` — já persiste entrada/saída (webhook + `send-message`), com realtime habilitado.
- `labels` + `conversation_labels` — já existem com RLS por workspace.
- `reminders` — já existe; vamos apenas reutilizar `useReminders` filtrado por `remote_jid`.
- `contact_photos` — avatar.
- `whatsapp_instances` — filtro de instâncias.

## O que precisa ser criado no banco

**Única tabela nova: `conversation_notes`**

```sql
create table public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  conversation_id uuid not null references conversations(id) on delete cascade,
  remote_jid text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversation_notes enable row level security;

create policy ws_select on public.conversation_notes for select to authenticated
  using (is_workspace_member(auth.uid(), workspace_id));
create policy ws_insert on public.conversation_notes for insert to authenticated
  with check (can_write_workspace(auth.uid(), workspace_id));
create policy ws_update on public.conversation_notes for update to authenticated
  using (can_write_workspace(auth.uid(), workspace_id));
create policy ws_delete on public.conversation_notes for delete to authenticated
  using (has_workspace_role(auth.uid(), workspace_id, 'admin'));

create index on public.conversation_notes (conversation_id, created_at desc);
alter publication supabase_realtime add table public.conversation_notes;
```

Registrar `conversation_notes` no array de tabelas multi-tenant em `deploy/migrate-workspace.sql` (regra já documentada na memória).

## Arquivos a criar / editar

**Novos:**
- `src/pages/ChatLive.tsx` — container 3 colunas.
- `src/components/chat/ConversationList.tsx` — coluna 1 com filtros e realtime em `conversations`.
- `src/components/chat/MessageThread.tsx` — coluna 2 com realtime em `messages`, scroll infinito, renderização por tipo de mídia.
- `src/components/chat/MessageComposer.tsx` — input + upload + envio via `whatsapp-proxy` action `send-message`.
- `src/components/chat/ContactPanel.tsx` — coluna 3 com tabs.
- `src/components/chat/LabelManager.tsx` — chips de etiquetas + popover para criar/atribuir/remover.
- `src/components/chat/NotesList.tsx` — lista + editor inline de notas.
- `src/components/chat/ContactReminders.tsx` — lista filtrada por `remote_jid` + botão "novo lembrete" (reutiliza `useCreateReminder`).
- `src/hooks/useConversations.ts` — query + subscribe realtime, filtros por instância/label/busca.
- `src/hooks/useMessages.ts` — query paginada + subscribe realtime por `conversation_id`.
- `src/hooks/useLabels.ts` — CRUD de `labels` e `conversation_labels`.
- `src/hooks/useConversationNotes.ts` — CRUD de notas.

**Editados:**
- `src/App.tsx` — adicionar rota `/chat` dentro do `AppLayout`/`ProtectedRoute`.
- `src/components/AppSidebar.tsx` — item de menu "Chat ao Vivo" (ícone `MessagesSquare`).
- `src/components/ManualFlowTrigger.tsx` — aceitar `defaultPhone` e `defaultInstance` como props para ser acionado já preenchido pelo painel do contato.

## Detalhes técnicos

- **Envio de mensagem:** chamada a `supabase.functions.invoke("whatsapp-proxy", { body: { action: "send-message", instanceName, remoteJid, text | mediaUrl, messageType, workspaceId } })`. O backend já insere na tabela `messages` (linha 303 do whatsapp-proxy) — a thread atualiza sozinha via realtime.
- **Realtime (3 canais):**
  - `conversations` — `postgres_changes event=*` filtrado por `workspace_id` para reordenar a lista e atualizar `unread_count`/`last_message`.
  - `messages` — filtrado por `conversation_id` da conversa aberta.
  - `conversation_notes` — filtrado por `conversation_id`.
- **Filtro por instância:** dropdown popula com `useWhatsAppInstances().instances`; quando "Todas" → sem filtro; quando específica → `.eq("instance_name", …)` em conversations.
- **Marcar como lida:** ao abrir conversa, `update conversations set unread_count = 0 where id = …`.
- **Permissões:** respeitar `can_write_workspace` — usuários sem permissão de escrita veem mas não enviam/editam (componentes checam `hasPermission` do `useWorkspace`, padrão já usado no projeto).
- **Mobile:** telas <768px mostram uma coluna por vez com navegação (lista → thread → painel), usando estado local.
- **Design:** segue paleta azul HSL 210 75% 52% sobre fundo HSL 215 28% 7%, ícones lucide, sem emojis hardcoded, modais com contenção horizontal estrita (memória `modal-layout-containment`).

## Fora do escopo (ficará para depois)

- Respostas rápidas dentro do chat (tabela `quick_replies` já existe — seria trivial adicionar depois como botão no composer).
- Transferir conversa entre operadores.
- Indicador "digitando..." (Baileys suporta mas exige mudança no gateway).
- Grupos do WhatsApp (removido da app, regra de memória).

## Pós-deploy

Rodar na VPS após o merge:

```bash
cd ~/simplificandoconversas && ./deploy/update.sh
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
```

Nenhuma nova variável de ambiente, nenhuma mudança no Baileys gateway.
