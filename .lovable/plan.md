

# Área de Membros — Implementação Completa

## Visão Geral

Portar o módulo completo de Área de Membros do Finance Hub para este projeto, adaptando para a arquitetura multi-tenant (workspace_id) já existente. O módulo terá 5 abas: Membros, Conteúdo, Ofertas, Atividade e Configurações.

## Etapa 1 — Criação das Tabelas (6 tabelas + 1 storage bucket)

Todas as tabelas terão `workspace_id` com RLS baseado em `is_workspace_member` / `can_write_workspace`.

### Tabelas a criar:

1. **delivery_products** — Produtos digitais (base para membros e entrega digital)
   - `id`, `workspace_id`, `name`, `slug`, `page_logo`, `value`, `is_active`, `member_cover_image`, `member_description`, etc.

2. **member_products** — Vínculo telefone → produto (acesso do membro)
   - `id`, `workspace_id`, `normalized_phone`, `product_id` (FK delivery_products), `is_active`, `granted_at`

3. **member_area_settings** — Configurações visuais e prompts de IA
   - `id`, `workspace_id`, `title`, `logo_url`, `welcome_message`, `theme_color`, `ai_persona_prompt`, `greeting_prompt`, `offer_prompt`, `layout_order`

4. **member_area_offers** — Ofertas exibidas na área pública
   - `id`, `workspace_id`, `name`, `product_id`, `description`, `image_url`, `purchase_url`, `price`, `display_type`, `pix_key`, `pix_key_type`, `card_payment_url`, `category_tag`, `total_impressions`, `total_clicks`, `is_active`, `sort_order`

5. **member_product_categories** — Categorias/módulos dentro de um produto
   - `id`, `workspace_id`, `product_id` (FK), `name`, `icon`, `description`, `sort_order`

6. **member_product_materials** — Materiais (PDF, vídeo, texto, áudio, imagem)
   - `id`, `workspace_id`, `product_id` (FK), `category_id` (FK), `title`, `description`, `content_type`, `content_url`, `content_text`, `button_label`, `sort_order`, `is_preview`

7. **member_sessions** — Sessões de atividade dos membros
   - `id`, `workspace_id`, `normalized_phone`, `started_at`, `last_heartbeat_at`, `ended_at`, `current_activity`, `current_product_name`, `current_material_name`

### Storage bucket:
- `member-files` (público) — para upload de imagens, PDFs, áudios

### RLS:
- SELECT: `is_workspace_member(auth.uid(), workspace_id)`
- INSERT/UPDATE: `can_write_workspace(auth.uid(), workspace_id)`
- DELETE: `has_workspace_role(auth.uid(), workspace_id, 'admin')`
- `member_sessions`: anon pode inserir/atualizar (acesso público), authenticated pode ler

## Etapa 2 — Componentes Frontend

### Arquivo principal: `src/pages/AreaMembros.tsx`
Reescrever completamente com 5 abas:

**Aba Membros** — Lista de membros agrupados por telefone
- Busca por telefone, dialog para liberar produto
- Cards expansíveis com: produtos liberados, link de acesso copiável, histórico de compras (via transactions)
- Stats: total membros, acessos ativos, total liberados

**Aba Conteúdo** — Gestão de materiais por produto
- Seletor de produto → editor de conteúdo
- Personalização do produto (capa, descrição)
- CRUD de categorias/módulos
- CRUD de materiais (texto, PDF, vídeo, imagem, áudio) com upload para storage

**Aba Ofertas** — Ofertas para upsell na área pública
- CRUD de ofertas vinculadas a produtos
- Tipos: Card ou Produto Físico (vitrine)
- Campos: PIX, cartão, preço, imagem, categoria
- Métricas: impressões, cliques, CTR, vendas

**Aba Atividade** — Monitoramento em tempo real
- Cards de stats: online agora, visitantes 24h, sessões, tempo médio
- Lista de membros online com atividade atual
- Tabela consolidada de sessões (24h) com status, duração, acessos
- Realtime subscription para atualizações automáticas

**Aba Configurações** — Personalização da área
- Título, logo, mensagem de boas-vindas, cor do tema
- Prompts de IA (persona, saudação, oferta)

### Componentes em `src/components/membros/`:
- `MemberClientCard.tsx` — Card expansível por membro
- `ContentManagement.tsx` — Editor de conteúdo por produto
- `MemberActivityTab.tsx` — Dashboard de atividade

### Utilitário:
- `src/lib/phoneNormalization.ts` — `generatePhoneVariations()` para match de telefones

## Etapa 3 — Integração

- Todos os hooks usam `useWorkspace()` para `workspaceId`
- Queries filtradas por `workspace_id`
- Permissão `area_membros` já configurada no sistema

## Observações

- A página pública (`AreaMembrosPublica`) não será incluída nesta etapa — foco no painel admin
- As tabelas `delivery_products` criadas aqui também servirão para o módulo "Entrega Digital" futuramente
- A migração na VPS deve ser aplicada manualmente via `migrate-workspace.sql` ou diretamente no container `deploy-postgres-1`

