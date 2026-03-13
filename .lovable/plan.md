

## Plano: Remover funcionalidade de Chat/Conversas

### O que será feito

Remover completamente a tela de Conversas e todos os componentes/hooks relacionados ao chat, simplificando a aplicação para focar nas funcionalidades que já funcionam (Dashboard, Contatos, Agendamentos, Fluxos, Configurações).

### Alterações

#### 1. `src/App.tsx` — Remover rota `/conversations`
- Remover import de `Conversations`
- Remover a linha `<Route path="/conversations" ...>`

#### 2. `src/components/AppSidebar.tsx` — Remover item "Conversas" do menu
- Remover o item `{ title: "Conversas", ... }` do array `mainItems`
- Remover o estado `unreadCount` e o `useEffect` que faz polling de conversas não lidas
- Remover import de `MessageSquare`

#### 3. Deletar arquivos de componentes de chat
- `src/pages/Conversations.tsx`
- `src/components/conversations/ChatPanel.tsx`
- `src/components/conversations/ConversationList.tsx`
- `src/components/conversations/RightPanel.tsx`
- `src/components/conversations/ContactAvatar.tsx`
- `src/components/conversations/WhatsAppAudioPlayer.tsx`

#### 4. Deletar hooks exclusivos do chat
- `src/hooks/useMessages.ts`
- `src/hooks/useConversations.ts`
- `src/hooks/useFlowExecutions.ts`

#### 5. Verificar e limpar referências restantes
- Verificar se `useContactPhoto.ts` e `useLabels.ts` são usados em outras páginas (Contatos, etc.) — manter se sim, deletar se não.

> **Nota:** Tabelas do banco (conversations, messages, etc.) permanecem intactas. Nenhuma migração necessária. A funcionalidade pode ser reativada no futuro.

