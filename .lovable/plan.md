

# Redesign da Sidebar + Configurações com aba de Integrações

## Objetivo
1. Sidebar mais compacta e profissional (botões menores, espaçamento reduzido)
2. Reformular as abas de Configurações com visual mais limpo
3. Nova aba "Integrações" nas Configurações com catálogo de integrações disponíveis (Mercado Pago, etc.)

## 1. Sidebar (`src/components/AppSidebar.tsx`)

Mudanças visuais:
- Reduzir altura dos botões de `h-10` para `h-8`
- Ícones de `h-5 w-5` para `h-4 w-4`
- Texto de `text-sm` para `text-xs`
- Header mais compacto (`p-5` para `p-3`)
- Logo de `h-9 w-9` para `h-7 w-7`
- Labels de grupo com `text-[9px]` e margin reduzido
- Footer mais compacto com avatar `h-7 w-7`
- Remover `space-y-0.5` dos menus, usar gap mínimo
- Separadores com `my-1` em vez de `my-2`

## 2. Configurações (`src/pages/SettingsPage.tsx`)

Mudanças:
- Trocar TabsList horizontal por navegação lateral com ícones (sidebar-style) para visual mais profissional
- Layout: coluna esquerda com lista de seções, coluna direita com conteúdo
- Adicionar nova seção "Integrações" com ícone Puzzle
- Manter todas as seções existentes (Perfil, Conexões, IA, API, E-mail, Aplicação)

## 3. Nova seção de Integrações (`src/components/settings/IntegrationsSection.tsx`)

Componente novo com:
- Header com título "Integrações" e botão "Nova Integração" no canto superior direito
- Grid de cards mostrando integrações disponíveis:
  - **Mercado Pago** - Gerar boletos e cobranças PIX
  - **Stripe** - Pagamentos internacionais
  - **PagBank** - Boletos e PIX
  - **Asaas** - Cobranças recorrentes
  - **OpenAI** - Inteligência artificial (já existente, migrar da aba IA)
- Cada card mostra: nome, descrição, status (Conectado/Disponível), botão Configurar/Conectar
- Ao clicar em "Configurar" no Mercado Pago, abre dialog para inserir o Access Token
- Salva as credenciais na tabela `platform_connections` (já existe) com `platform: "mercadopago"` e `credentials: { access_token: "..." }`
- O backend `payment.ts` será atualizado futuramente para buscar o token do banco em vez da env var

## Arquivos modificados

1. **`src/components/AppSidebar.tsx`** - Sidebar compacta
2. **`src/pages/SettingsPage.tsx`** - Layout reformulado com navegação lateral + nova aba Integrações
3. **`src/components/settings/IntegrationsSection.tsx`** (novo) - Catálogo de integrações com CRUD de credenciais via `platform_connections`

## Detalhes técnicos

- A tabela `platform_connections` já existe com colunas `platform`, `credentials` (jsonb), `enabled` - perfeita para armazenar tokens de integrações
- Nenhuma migration necessária
- As integrações futuras (Stripe, PagBank, etc.) ficam como cards "Em breve" desabilitados
- O Mercado Pago será o único configurável por enquanto

