

# Super Admin + Permissões Granulares por Workspace

## Visão Geral

Você (user_id `d2abc992...`) já tem `app_role = 'admin'` na tabela `user_roles`. Vamos usar isso como conceito de **Super Admin** — acesso total a TODOS os workspaces, sem precisar ser membro de cada um. Usuários comuns só veem os workspaces aos quais foram atribuídos, com permissões granulares por funcionalidade.

## Arquitetura

```text
┌─────────────────────────────────────────┐
│  user_roles.role = 'admin'              │  ← Super Admin (você)
│  Vê TODOS os workspaces                 │
│  Acesso total a TUDO                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  workspace_members                      │  ← Usuários comuns
│  + role (admin/operator/viewer)         │
│  + permissions (jsonb) ← NOVO          │
│  Só vê workspaces atribuídos            │
│  Só vê abas/funcionalidades permitidas  │
└─────────────────────────────────────────┘
```

## Mudanças

### 1. Schema: Adicionar `permissions` em `workspace_members`

```sql
ALTER TABLE workspace_members
ADD COLUMN permissions jsonb NOT NULL DEFAULT '{}';
```

O campo `permissions` armazena quais funcionalidades o membro pode acessar:
```json
{
  "dashboard": true,
  "chatbot": true,
  "email": false,
  "leads": true,
  "transacoes": false,
  "reminders": true,
  "recuperacao": false,
  "gerar_boleto": false,
  "grupos": false,
  "area_membros": false,
  "entrega": false,
  "links_uteis": false,
  "settings": false,
  "disparar_fluxo": false
}
```

Super admins e workspace admins ignoram este campo (acesso total).

### 2. Frontend: `useWorkspace.tsx`

- Adicionar query para `user_roles` para detectar se o usuário é Super Admin
- Se Super Admin: carregar TODOS os workspaces (não apenas os que tem membership), com role `"admin"` implícito
- Expor `isSuperAdmin: boolean` e `permissions: Record<string, boolean>` no contexto

### 3. Frontend: `AppSidebar.tsx`

- Filtrar itens do menu baseado em `permissions` do workspace ativo
- Super Admin e workspace admin veem tudo; outros veem apenas o permitido

### 4. Frontend: `TeamSection.tsx` (Configurações > Equipe)

- Ao adicionar/editar membro, exibir checkboxes para cada funcionalidade
- Salvar no campo `permissions` do `workspace_members`
- Super Admin pode gerenciar equipe de QUALQUER workspace

### 5. Frontend: Proteção nas rotas/páginas

- Cada página verifica se o usuário tem permissão via `useWorkspace().permissions`
- Se não tem permissão, redireciona para dashboard ou mostra mensagem

### 6. Frontend: `WorkspaceSwitcher.tsx`

- Super Admin vê todos os workspaces no dropdown
- Usuários comuns só veem os que são membros

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Adicionar coluna `permissions` jsonb |
| `src/hooks/useWorkspace.tsx` | Super Admin detection + permissions no contexto |
| `src/components/AppSidebar.tsx` | Filtrar menu por permissions |
| `src/components/settings/TeamSection.tsx` | UI de checkboxes para permissões granulares |
| `src/components/WorkspaceSwitcher.tsx` | Super Admin vê todos workspaces |
| `src/pages/*.tsx` (rotas protegidas) | Verificar permission antes de renderizar |

## Resultado Final

- **Você (Super Admin)**: vê TODOS os workspaces, acessa TUDO, gerencia equipe de qualquer workspace
- **Usuários comuns**: só veem workspaces atribuídos, só acessam funcionalidades marcadas pelo admin
- **Isolamento mantido**: dados continuam isolados por workspace_id via RLS

