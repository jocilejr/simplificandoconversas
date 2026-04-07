

# Sistema Multi-Tenant com Workspaces

## Visao Geral

Transformar o sistema de single-tenant (filtrado por `user_id`) para multi-tenant com workspaces independentes. Cada workspace tem seus proprios dados, conexoes, fluxos e usuarios com 3 niveis de acesso.

## Arquitetura

```text
┌─────────────────────────────────────────┐
│              workspaces                 │
│  id, name, slug, created_by, created_at │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│          workspace_members              │
│  workspace_id, user_id, role            │
│  role: admin | operator | viewer        │
└─────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
 chatbot_flows  leads     transactions ...
 (+ workspace_id em todas as tabelas de dados)
```

## Etapas

### 1. Banco de Dados — Novas tabelas e migracao

**Criar tabelas:**
- `workspaces` (id, name, slug, logo_url, created_by, created_at)
- `workspace_members` (id, workspace_id, user_id, role enum `workspace_role` [admin, operator, viewer], invited_by, created_at)
  - Unique constraint em (workspace_id, user_id)

**Funcoes auxiliares (SECURITY DEFINER):**
- `get_user_workspace_ids(uuid)` — retorna array de workspace_ids do usuario
- `has_workspace_role(uuid, uuid, workspace_role)` — verifica se usuario tem role X no workspace Y
- `get_active_workspace_id()` — le do JWT claim ou de uma tabela de sessao

**Adicionar `workspace_id`** (uuid, NOT NULL com default temporario) em todas as tabelas de dados:
- `chatbot_flows`, `chatbot_flow_history`, `flow_executions`, `flow_timeouts`
- `conversations`, `messages`, `contact_tags`, `contact_photos`, `conversation_labels`
- `transactions`, `reminders`, `tracked_links`
- `email_*` (templates, contacts, campaigns, sends, queue, etc.)
- `whatsapp_instances`, `platform_connections`, `profiles`, `ai_config`
- `api_request_logs`, `meta_pixels`, `quick_replies`, `labels`

**Migracao de dados existentes:**
- Criar workspace automatico para o admin atual
- Popular `workspace_id` em todos os registros existentes
- Tornar `workspace_id` NOT NULL apos populacao

**Atualizar todas as RLS policies:**
- Trocar `user_id = auth.uid()` por verificacao de membership no workspace via funcao SECURITY DEFINER
- Operador: SELECT + INSERT + UPDATE (sem DELETE em config)
- Visualizador: apenas SELECT

### 2. Backend (Express) — Workspace-aware

- Middleware para extrair `workspace_id` do header `X-Workspace-Id` e validar membership
- Todas as queries usam `workspace_id` em vez de (ou alem de) `user_id`
- Webhook routes (OpenPix, Evolution) resolvem workspace via `platform_connections` ou `whatsapp_instances`
- Platform API: validar que a API key pertence ao workspace

### 3. Frontend — Workspace Switcher e Gestao

**Hook `useWorkspace`:**
- Estado global do workspace ativo (localStorage + context)
- Todas as queries Supabase passam `workspace_id` como filtro

**Workspace Switcher (sidebar header):**
- Dropdown para alternar entre workspaces
- Opcao "Criar novo workspace"

**Pagina de Gestao de Usuarios** (`/settings` > nova secao "Equipe"):
- Listar membros do workspace com roles
- Convidar usuario por email (cria conta se nao existe)
- Alterar role (admin/operador/visualizador)
- Remover membro

**Controle de acesso no frontend:**
- Hook `useWorkspaceRole()` retorna role do usuario no workspace ativo
- Componente `<RoleGate role="admin">` para esconder elementos
- Visualizador: botoes de edicao/exclusao desabilitados
- Operador: sem acesso a Configuracoes > Conexoes e Integrações

### 4. Fluxo de Onboarding

- Ao criar conta (via `install.sh`), criar workspace default automaticamente
- Admin atual vira admin do workspace default
- Novo endpoint no backend: `POST /api/workspace/invite` (envia email com link)

## Secoes da sidebar afetadas por role

| Secao | Admin | Operador | Visualizador |
|-------|-------|----------|-------------|
| Dashboard | Total | Total | Somente leitura |
| Fluxos | CRUD | CRUD | Ver |
| Leads | CRUD | CRUD | Ver |
| Transacoes | CRUD | CRUD | Ver |
| E-mail | CRUD | CRUD | Ver |
| Configuracoes | Total | Parcial | Oculto |
| Equipe | Gerenciar | Ver | Oculto |

## Detalhes Tecnicos

**Tabelas modificadas:** ~20 tabelas recebem coluna `workspace_id`
**Novas tabelas:** 2 (`workspaces`, `workspace_members`)
**Novos tipos:** 1 enum (`workspace_role`)
**Novas funcoes DB:** 2-3 SECURITY DEFINER
**RLS policies:** Todas reescritas (~20 tabelas)
**Arquivos frontend novos:** ~5 (WorkspaceProvider, WorkspaceSwitcher, TeamManagement, RoleGate, useWorkspaceRole)
**Arquivos frontend modificados:** Todos os hooks de dados + AppSidebar + SettingsPage
**Arquivos backend modificados:** Middleware + todas as rotas

**Importante:** Esta e uma mudanca estrutural grande. Sera implementada em fases para minimizar riscos. A fase 1 foca nas tabelas e migracao de dados. A fase 2 no backend. A fase 3 no frontend.

