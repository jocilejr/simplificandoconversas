

# Plano: Criar página de Respostas Rápidas no estilo Finance Hub

## Visão geral
Criar uma nova página `/respostas-rapidas` com layout sidebar+grid inspirado no projeto Finance Hub, adaptado para a tabela `quick_replies` existente (que tem `title` e `content`, sem `category`).

## Alterações

### 1. Migração — Adicionar coluna `category` à tabela `quick_replies`
```sql
ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Geral';
```

### 2. Novo componente `src/components/quick-replies/QuickReplyCard.tsx`
Card com título, conteúdo (line-clamp-3), botão de copiar, menu dropdown (editar/excluir). Modo de edição inline com Input+Textarea. Estilo idêntico ao Finance Hub.

### 3. Novo componente `src/components/quick-replies/QuickRepliesList.tsx`
Header com título da categoria, contador, campo de busca e botão "Nova Resposta" (dialog com título, categoria, mensagem). Grid responsivo de cards (`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`). Estado vazio com ícone centralizado.

### 4. Novo componente `src/components/quick-replies/QuickRepliesSidebar.tsx`
Sidebar lateral (w-64) com lista de categorias, item "Todas", botão de criar categoria via dialog, renomear categoria via dropdown.

### 5. Nova página `src/pages/RespostasRapidas.tsx`
Composição: sidebar + lista. Usa `useQuickReplies` atualizado.

### 6. Atualizar `src/hooks/useQuickReplies.ts`
- Adicionar `category` ao tipo `QuickReply`
- Expor `categories` (derived do data)
- Adicionar `category` ao `create` e `update`
- Adicionar mutation `renameCategory` (batch update)

### 7. Atualizar `src/App.tsx`
- Adicionar rota `/respostas-rapidas` com `PermissionGate` (usar permission existente ou nova)

### 8. Atualizar `src/components/AppSidebar.tsx`
- Adicionar item "Respostas Rápidas" no grupo Operacional com ícone `MessageSquareText`

### 9. Atualizar `src/hooks/useWorkspace.tsx`
- Adicionar permission key `respostas_rapidas` em `ALL_PERMISSIONS`

## Arquivos
- **Migração SQL**: adicionar `category` a `quick_replies`
- `src/components/quick-replies/QuickReplyCard.tsx` (novo)
- `src/components/quick-replies/QuickRepliesList.tsx` (novo)
- `src/components/quick-replies/QuickRepliesSidebar.tsx` (novo)
- `src/pages/RespostasRapidas.tsx` (novo)
- `src/hooks/useQuickReplies.ts` (atualizar)
- `src/App.tsx` (nova rota)
- `src/components/AppSidebar.tsx` (novo item sidebar)
- `src/hooks/useWorkspace.tsx` (nova permission)

