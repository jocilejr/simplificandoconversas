

## Problema

A URL de webhook exibida na página de integrações usa `app.chatbotsimplificado.com` (domínio do frontend), mas os webhooks precisam apontar para `api.chatbotsimplificado.com` (domínio da API/backend). Isso faz com que os webhooks configurados na Yampi nunca cheguem ao backend.

## Solução

### 1. Adicionar campo `api_public_url` na tabela `workspaces`

Criar uma migração para adicionar a coluna `api_public_url` à tabela `workspaces`, separando o domínio do app do domínio da API.

### 2. Atualizar a geração de URL de webhook em `IntegrationsSection.tsx`

Na linha 298, usar `api_public_url` do workspace (ou um campo dedicado) em vez de `app_public_url` para construir a URL do webhook.

Lógica: `baseUrl = workspace.api_public_url || profile.app_public_url?.replace('app.', 'api.') || "https://SEU-API-DOMAIN"`

### 3. Adicionar campo "URL da API" na seção de configurações do App (`AppSection.tsx`)

Adicionar um input para `api_public_url` ao lado do `app_public_url` existente, para que o usuário configure explicitamente o domínio da API.

### 4. Atualizar valor no banco (instrução para VPS)

Fornecer comando SQL para definir `api_public_url = 'https://api.chatbotsimplificado.com'` no workspace.

## Alternativa mais simples

Em vez de criar uma nova coluna, podemos simplesmente derivar a URL da API a partir da URL do app, substituindo `app.` por `api.` automaticamente na geração do webhook URL. Isso não exige migração nem campo extra, mas assume que a convenção de domínio sempre segue o padrão `app.` → `api.`.

## Impacto
- Corrige a URL de webhook exibida na interface
- Garante que ao copiar a URL, o usuário configure o endereço correto na Yampi
- Nenhuma mudança no backend — apenas no frontend

