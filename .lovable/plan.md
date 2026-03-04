

## Analise

A pagina de Conversas atualmente é um layout simples com dois painéis (lista + chat) dentro de um `div` com borda. O problema principal: está dentro do `<main className="flex-1 overflow-auto p-6">` do AppLayout, o que adiciona padding de 24px ao redor e faz parecer um componente "solto", não integrado.

Além disso, faltam duas funcionalidades: **respostas rápidas** e **etiquetas**, ambas salvas no banco.

---

## Plano

### 1. Banco de Dados — duas novas tabelas

**`quick_replies`** — respostas rápidas salvas por usuário:
- `id` (uuid), `user_id` (uuid, not null), `title` (text), `content` (text), `created_at`
- RLS: cada usuário vê/edita apenas os seus

**`labels`** — etiquetas coloridas por usuário:
- `id` (uuid), `user_id` (uuid, not null), `name` (text), `color` (text, default '#3b82f6'), `created_at`
- RLS: cada usuário vê/edita apenas os seus

**`conversation_labels`** — relação N:N entre conversas e etiquetas:
- `id` (uuid), `conversation_id` (uuid, FK), `label_id` (uuid, FK), `user_id` (uuid)
- RLS por user_id

### 2. Redesign completo do layout de Conversas

O layout atual será substituído por um design de 3 colunas integrado ao app, removendo o padding do `<main>` especificamente para a rota `/conversations`:

**Estrutura:**

```text
┌──────────────────────────────────────────────────┐
│ AppLayout (sidebar + header)                     │
├─────────┬────────────────────┬───────────────────┤
│ Lista   │                    │ Painel Lateral    │
│ Conversas│    Chat Area      │ - Info contato    │
│ + busca │    (mensagens)     │ - Etiquetas       │
│ + filtro│                    │ - Respostas rápidas│
│ etiqueta│                    │                   │
│         │                    │                   │
│         ├────────────────────┤                   │
│         │ Input + bot btn    │                   │
├─────────┴────────────────────┴───────────────────┤
```

**Mudanças específicas:**

- **AppLayout.tsx**: Detectar rota `/conversations` e remover o `p-6` do `<main>`, usando `p-0` e `overflow-hidden` para que o chat ocupe 100% do espaço
- **Conversations.tsx**: Layout de 3 painéis usando flex, ocupando `h-full` sem bordas externas artificiais
- **ConversationList.tsx**: Redesign com header mais limpo, filtro por etiqueta, visual mais integrado (sem borda arredondada externa)
- **ChatPanel.tsx**: Header refinado com botão para abrir/fechar painel lateral, background sutil com pattern, input area mais polida com botão de respostas rápidas (ícone Zap)
- **Novo: RightPanel.tsx**: Painel lateral direito colapsável com:
  - Seção de informações do contato
  - Seção de etiquetas (adicionar/remover etiquetas na conversa)
  - Seção de respostas rápidas (lista + criar/editar/excluir)

### 3. Hooks novos

- **`useQuickReplies.ts`**: CRUD de respostas rápidas
- **`useLabels.ts`**: CRUD de etiquetas + associação com conversas

### 4. Funcionalidade de Respostas Rápidas

- Botão com ícone `Zap` ao lado do input de mensagem
- Popover com lista de respostas rápidas salvas
- Clicar em uma resposta insere o texto no input
- Gerenciamento completo (criar, editar, excluir) no painel lateral direito

### 5. Funcionalidade de Etiquetas

- Filtro por etiqueta na lista de conversas
- Badges coloridos visíveis nos itens da lista
- Gerenciamento de etiquetas no painel lateral direito (criar, atribuir/remover de conversa)
- Cada etiqueta tem nome e cor customizável

### 6. Arquivos impactados

- **Criar**: `src/hooks/useQuickReplies.ts`, `src/hooks/useLabels.ts`, `src/components/conversations/RightPanel.tsx`
- **Editar**: `src/components/AppLayout.tsx`, `src/pages/Conversations.tsx`, `src/components/conversations/ConversationList.tsx`, `src/components/conversations/ChatPanel.tsx`
- **Migração SQL**: 1 arquivo com as 3 tabelas + RLS

