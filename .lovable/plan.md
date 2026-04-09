

# Entrega Digital — Implementação Completa

## Visão Geral

Portar o módulo de Entrega Digital do Finance Hub, adaptando para multi-tenant (workspace_id). O módulo compartilha a tabela `delivery_products` já criada na Área de Membros, unificando produtos digitais, pixels de tracking e acessos.

## Etapa 1 — Migração de Banco (4 novas tabelas + colunas extras)

### Colunas faltantes em `delivery_products`
A tabela já existe mas faltam colunas do Finance Hub:
- `whatsapp_number` text
- `whatsapp_message` text
- `delivery_webhook_url` text
- `redirect_url` text
- `page_title` text default 'Preparando sua entrega...'
- `page_message` text default 'Você será redirecionado em instantes'
- `redirect_delay` integer default 3

### Novas tabelas

1. **delivery_pixels** — Pixels por produto
   - `id`, `workspace_id`, `product_id` (FK delivery_products), `platform`, `pixel_id`, `access_token`, `event_name`, `is_active`

2. **global_delivery_pixels** — Pixels globais do workspace
   - `id`, `workspace_id`, `platform`, `pixel_id`, `access_token`, `event_name`, `is_active`

3. **delivery_accesses** — Registro de acessos à página pública
   - `id`, `workspace_id`, `product_id` (FK), `phone`, `accessed_at`, `pixel_fired`, `webhook_sent`

4. **delivery_settings** — Configurações de domínio/mensagem por workspace
   - `id`, `workspace_id`, `custom_domain`, `global_redirect_url`, `link_message_template`

5. **delivery_link_generations** — Tracking de links gerados
   - `id`, `workspace_id`, `product_id` (FK), `phone`, `normalized_phone`, `payment_method`

### RLS
Mesmo padrão do projeto: SELECT via `is_workspace_member`, INSERT/UPDATE via `can_write_workspace`, DELETE via `has_workspace_role(..., 'admin')`.

## Etapa 2 — Componentes Frontend (7 arquivos)

### `src/pages/EntregaDigital.tsx` — Reescrever
4 abas: Produtos, Pixels, Acessos, Domínio

### `src/components/entrega/ProductsTab.tsx`
- Lista de produtos com busca, badge ativo/inativo, slug, valor
- CRUD via dialog (ProductForm) + duplicar + excluir
- Clicar no produto abre LinkGenerator (liberar acesso + gerar link)
- Queries filtradas por `workspace_id`

### `src/components/entrega/ProductForm.tsx`
- Dialog com 2 abas: Básico (nome, slug, valor, webhook, ativo) e Página (logo, título, mensagem, delay)

### `src/components/entrega/LinkGenerator.tsx`
- Dialog em 2 passos: 1) informar telefone → liberar acesso em `member_products` + registrar em `delivery_link_generations`, 2) exibir link copiável com mensagem template
- **Conexão com Área de Membros**: libera acesso direto na tabela `member_products`, unificando entrega e membros

### `src/components/entrega/AccessesTab.tsx`
- Tabela de acessos com filtro por produto e busca
- Exibe produto, telefone, data, status do pixel e webhook

### `src/components/entrega/GlobalPixelsConfig.tsx`
- CRUD de pixels globais (Meta, TikTok, Google, Pinterest, Taboola)
- Toggle ativo/inativo por pixel

### `src/components/entrega/DomainSettings.tsx`
- URL de redirecionamento global, mensagem do link (com placeholder `{link}`), domínio personalizado
- Instruções de configuração DNS

## Etapa 3 — Integração Unificada

- **Leads**: O LinkGenerator registra `delivery_link_generations` com `normalized_phone`, permitindo que a tela de Leads exiba histórico de links gerados por contato
- **Área de Membros**: O LinkGenerator insere em `member_products` ao liberar acesso, garantindo que o mesmo produto aparece nas duas interfaces
- **Produtos compartilhados**: `delivery_products` é a tabela base tanto para Entrega quanto para Área de Membros — alterações em um refletem no outro

## Arquivos alterados/criados

| Arquivo | Ação |
|---------|------|
| Migration SQL | ALTER delivery_products + CREATE 4 tabelas + RLS |
| `src/pages/EntregaDigital.tsx` | Reescrever com 4 abas |
| `src/components/entrega/ProductsTab.tsx` | Criar |
| `src/components/entrega/ProductForm.tsx` | Criar |
| `src/components/entrega/LinkGenerator.tsx` | Criar |
| `src/components/entrega/AccessesTab.tsx` | Criar |
| `src/components/entrega/GlobalPixelsConfig.tsx` | Criar |
| `src/components/entrega/DomainSettings.tsx` | Criar |

