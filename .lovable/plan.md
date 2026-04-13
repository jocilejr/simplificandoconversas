

## Plano: Smart Link + Melhorias no Módulo de Grupos

### Conceito do Smart Link

Inspirado no repositório `whats-grupos`, o **Smart Link** é um rotacionador inteligente de grupos WhatsApp. Você cria uma URL única (ex: `seudominio.com/r/meu-link`) e o sistema redireciona automaticamente para o grupo com menos membros, respeitando um limite máximo por grupo. Quando um grupo lota, o link direciona para o próximo.

A implementação será **nova e adaptada** ao seu sistema existente (workspace, Evolution API via VPS backend, tabelas `group_campaigns`/`group_selected`).

### Diferenças da implementação original

| Original (whats-grupos) | Nossa implementação |
|---|---|
| Supabase direto (sem VPS) | Backend Express na VPS |
| Tabela `campaign_smart_links` separada | Tabela `group_smart_links` vinculada a campanhas |
| Edge function `smart-link-redirect` | Rota Express `/groups/smart-link-redirect` |
| Busca `invite_url` via Baileys | Busca via Evolution API `inviteCode` |
| Sem workspace | Multi-workspace com RLS |

---

### 1. Migração de banco — nova tabela `group_smart_links`

```sql
CREATE TABLE public.group_smart_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.group_campaigns(id) ON DELETE CASCADE,
  slug text NOT NULL,
  max_members_per_group int NOT NULL DEFAULT 200,
  group_links jsonb NOT NULL DEFAULT '[]',
  current_group_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

CREATE TABLE public.group_smart_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_link_id uuid NOT NULL REFERENCES public.group_smart_links(id) ON DELETE CASCADE,
  group_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

RLS para ambas seguindo o padrão `is_workspace_member` / `can_write_workspace`.

### 2. Backend — novas rotas em `deploy/backend/src/routes/groups-api.ts`

- **`GET /groups/smart-link-redirect?slug=xxx`** — rota pública (sem auth), resolve o slug, busca `member_count` dos grupos via `group_selected`, aplica lógica de rotação (grupo com menos membros abaixo do limite), registra clique, retorna `{ redirect_url }`.
- **`POST /groups/smart-links`** — cria smart link para uma campanha.
- **`PUT /groups/smart-links/:id`** — atualiza slug, max_members, group_links.
- **`GET /groups/smart-links?campaignId=xxx`** — busca smart link de uma campanha.
- **`DELETE /groups/smart-links/:id`** — remove smart link.
- **`POST /groups/sync-invite-links`** — busca invite code de cada grupo via Evolution API (`/group/inviteCode/{instance}?groupJid=xxx`), atualiza `group_links[].invite_url`.
- **`GET /groups/smart-link-stats?smartLinkId=xxx`** — cliques e entradas por grupo.

### 3. Frontend — novo componente `GroupSmartLinkDialog.tsx`

Dialog acessível via botão "Smart Link" no card de campanha (ao lado de "Programação"). Contém:

- **Configuração**: campo slug, limite max_members_per_group
- **URL pública**: preview + botão copiar (`seudominio.com/r/{slug}`)
- **Tabela de grupos**: nome, membros atuais, invite URL (com status), cliques, entradas
- **Botão "Sincronizar URLs"**: busca invite codes via Evolution API para cada grupo da campanha
- **Cards de resumo**: total de cliques, total de entradas

### 4. Frontend — página de redirect `SmartLinkRedirect.tsx`

Página pública (sem login) em `/r/:slug`:
- Chama `GET /groups/smart-link-redirect?slug=xxx`
- Se sucesso: redireciona para a URL de convite do grupo
- Se erro: mostra mensagem amigável
- Suporta modo `-get` (slug termina com `-get`) que retorna a URL em texto plano

### 5. Integração na rota e no card de campanha

- Adicionar rota `/r/:slug` no `App.tsx`
- Adicionar botão "Smart Link" no `GroupCampaignsTab.tsx` (ícone Link, ao lado de Programação)

### Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL (2 tabelas + RLS) | Criar |
| `deploy/backend/src/routes/groups-api.ts` | Alterar (adicionar rotas smart link) |
| `src/components/grupos/GroupSmartLinkDialog.tsx` | Criar |
| `src/hooks/useGroupSmartLinks.ts` | Criar |
| `src/pages/SmartLinkRedirect.tsx` | Criar |
| `src/components/grupos/GroupCampaignsTab.tsx` | Alterar (botão Smart Link) |
| `src/App.tsx` | Alterar (rota `/r/:slug`) |

