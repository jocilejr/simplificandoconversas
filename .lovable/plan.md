

# Plano: Mover config de e-mail para Configurações + Redesign completo da página de E-mail

## Resumo
Mover SMTP e Webhooks para a página de Configurações (nova aba "E-mail") e redesenhar completamente a página /email com layout profissional, eliminando botões genéricos e melhorando o editor de templates.

---

## 1. Configurações — Nova aba "E-mail"

Adicionar uma 6a aba "E-mail" nas Configurações que conterá:
- **SMTP** (mover `SmtpSection` da aba "Aplicação" para cá)
- **Webhooks** (mover conteúdo de `EmailWebhooksTab` para cá, com documentação de endpoints e logs)
- **Chave de API** — mostrar a API Key existente (da `platform_connections`) com aviso de que é usada no header `X-API-Key` dos webhooks

Remover `SmtpSection` da `AppSection`.

**Arquivo**: `src/components/settings/EmailSettingsSection.tsx` (novo)
**Modificar**: `SettingsPage.tsx` (adicionar aba), `AppSection.tsx` (remover SmtpSection)

---

## 2. Redesign da página /email

### Cabeçalho
- Título maior com subtítulo descritivo
- Cards de métricas (stats) no topo da página (não dentro da aba Histórico)

### Aba Templates — Redesign completo
- **Lista de templates**: cards com preview thumbnail do HTML (mini iframe), nome, assunto, data de criação
- **Editor**: layout mais polido com:
  - Header com nome/assunto em inputs limpos (sem labels pesados)
  - Barra de ferramentas mais visual com ícones maiores e tooltips
  - Editor de código com fundo escuro e fonte mono
  - Preview com borda e sombra, toggle desktop/mobile mais visível
  - Botões de ação com cores distintas (Salvar = primary, Preview = outline, Cancelar = ghost)

### Aba Campanhas — Melhorias visuais
- Cards de campanha mais elaborados com progress bar para envio
- Status badges com ícones
- Formulário de criação mais organizado com seções visuais

### Aba Histórico — Mover stats para o header da página
- Remover cards de stats da aba (já estarão no topo)
- Tabela com estilo mais limpo

### Remover aba "Webhooks" da página /email
- Já estará nas Configurações

**Resultado**: página /email fica com 3 abas: Templates, Campanhas, Histórico

---

## 3. Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/components/settings/EmailSettingsSection.tsx` | **Novo** — SMTP + Webhooks + API Key |
| `src/pages/SettingsPage.tsx` | Adicionar aba "E-mail" (6 colunas no grid) |
| `src/components/settings/AppSection.tsx` | Remover import e uso de `SmtpSection` |
| `src/pages/EmailPage.tsx` | Redesign: stats no topo, remover aba Webhooks |
| `src/components/email/EmailTemplatesTab.tsx` | Redesign completo do layout |
| `src/components/email/EmailCampaignsTab.tsx` | Melhorias visuais (progress bar, badges) |
| `src/components/email/EmailHistoryTab.tsx` | Remover stats (movidos para header) |

