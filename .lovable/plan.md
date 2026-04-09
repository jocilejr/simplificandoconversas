

# Reestruturação: Entrega Digital e Área de Membros

## Resumo das Alterações

Simplificar a Entrega Digital (remover pixels, domínio, campos desnecessários do produto), mover configurações da Área de Membros para Configurações, e reformular os campos de settings.

## 1. Entrega Digital — Simplificar (`src/pages/EntregaDigital.tsx`)

- Remover abas "Pixels" e "Domínio" — ficam apenas **Produtos** e **Acessos**
- Remover imports de `GlobalPixelsConfig` e `DomainSettings`

## 2. ProductForm — Simplificar (`src/components/entrega/ProductForm.tsx`)

- Remover campos: `delivery_webhook_url`, `redirect_url`, `whatsapp_number`, `whatsapp_message`, `page_title`, `page_message`, `redirect_delay`, `page_logo`
- Remover a aba "Página" inteira — formulário fica flat
- Manter apenas: **Nome**, **Slug**, **Valor (R$)**, **Ativo/Inativo**

## 3. Configurações — Nova seção "Área de Membros" (`src/pages/SettingsPage.tsx`)

- Adicionar nova seção `member_area` no menu lateral (ícone Crown, minRole "admin")
- Renderizar novo componente `MemberAreaSettingsSection`

## 4. Novo componente: `src/components/settings/MemberAreaSettingsSection.tsx`

Conterá 2 sub-abas internas:

### Sub-aba "Ajustes"
- **Título da página** (title) — usado como `<title>` da URL pública, não exibido na página
- **Favicon URL** (renomeia `logo_url` para `favicon_url` no campo, mas mantém coluna `logo_url` no DB para evitar migração)
- **Descrição** (renomeia "Mensagem de boas-vindas" para "Descrição")
- **Remover** campo "Cor do tema"
- Prompts de IA: persona, saudação, oferta (mantém como está)

### Sub-aba "Domínio"
- Move o conteúdo de `DomainSettings.tsx` para cá
- Mostra o IP/URL para redirecionamento do domínio
- Configurações de domínio personalizado, URL de redirecionamento global, template de mensagem

## 5. Área de Membros — Remover aba "Configurações" (`src/pages/AreaMembros.tsx`)

- Remover `MemberSettingsTab` e a aba "Configurações" do TabsList
- Manter apenas: Membros, Conteúdo, Ofertas, Atividade

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/pages/EntregaDigital.tsx` | Remover abas Pixels e Domínio |
| `src/components/entrega/ProductForm.tsx` | Manter apenas Nome, Slug, Valor, Ativo |
| `src/pages/SettingsPage.tsx` | Adicionar seção "Área de Membros" |
| `src/components/settings/MemberAreaSettingsSection.tsx` | Criar com sub-abas Ajustes + Domínio |
| `src/pages/AreaMembros.tsx` | Remover aba Configurações e `MemberSettingsTab` |

Nenhuma migração de banco necessária — os campos permanecem no DB, apenas não são expostos na UI de criação de produto.

