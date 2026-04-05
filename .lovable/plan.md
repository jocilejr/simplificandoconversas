

# Plano: Sistema de E-mail Marketing + Transacional (Hostinger SMTP)

## Visão geral

Criar uma página "E-mail" no app com capacidade de:
- Criar e salvar templates de e-mail (editor visual)
- Enviar e-mails individuais (transacionais) e em massa (campanhas)
- Selecionar destinatários por tags dos contatos
- Acompanhar histórico de envios
- Tudo via SMTP da Hostinger, processado no backend Express da VPS

## Pré-requisitos do usuário

Você vai precisar configurar nas variáveis de ambiente do deploy (`.env`):
- `SMTP_HOST` (ex: `smtp.hostinger.com`)
- `SMTP_PORT` (ex: `465`)
- `SMTP_USER` (seu e-mail Hostinger)
- `SMTP_PASS` (senha do e-mail)
- `SMTP_FROM` (ex: `contato@seudominio.com`)

---

## 1. Banco de dados -- 3 novas tabelas

### `email_templates`
- `id`, `user_id`, `name`, `subject`, `html_body`, `created_at`, `updated_at`

### `email_campaigns`
- `id`, `user_id`, `name`, `template_id` (FK), `tag_filter` (text, tag usada para filtrar contatos), `status` (draft/sending/sent/failed), `total_recipients`, `sent_count`, `failed_count`, `created_at`, `sent_at`

### `email_sends`
- `id`, `user_id`, `campaign_id` (FK nullable), `template_id` (FK), `recipient_email`, `recipient_name`, `status` (pending/sent/failed), `error_message`, `created_at`

RLS: todas com policy `user_id = auth.uid()` para ALL.
Incluir no `deploy/update.sh` e `deploy/init-db.sql`.

## 2. Backend Express -- nova rota `/api/email`

Adicionar `nodemailer` ao `deploy/backend/package.json`.

### Endpoints:

- **POST `/api/email/send`** -- Envio individual
  - Body: `{ to, subject, html, userId }`
  - Usa Nodemailer com SMTP Hostinger
  - Registra em `email_sends`

- **POST `/api/email/campaign`** -- Disparo em massa
  - Body: `{ campaignId, userId }`
  - Busca contatos pela tag da campanha (da tabela `conversations` + `contact_tags`)
  - Filtra contatos que tenham `customer_email` ou extrai do campo disponível
  - Envia sequencialmente com delay configurável (evitar bloqueio SMTP)
  - Atualiza `email_campaigns.sent_count` e `email_campaigns.status`
  - Registra cada envio em `email_sends`

### Importante:
- Delay de 2-5 segundos entre envios para não ser bloqueado pelo SMTP
- Tratamento de erro por destinatário (não para a campanha toda)

## 3. Frontend -- nova página `/email`

### Sidebar
- Adicionar item "E-mail" com ícone `Mail` no menu principal

### Página com 3 abas:

**Aba "Templates"**
- Lista de templates salvos
- Botão "Novo Template"
- Editor: nome, assunto, corpo HTML (textarea com preview)
- CRUD completo via Supabase client

**Aba "Campanhas"**
- Lista de campanhas com status (badge colorido)
- Botão "Nova Campanha"
- Formulário: nome, selecionar template, selecionar tag de filtro
- Preview de quantos contatos serão atingidos
- Botão "Enviar Campanha" com confirmação
- Chamada ao backend `/api/email/campaign`

**Aba "Histórico"**
- Tabela de envios recentes (`email_sends`)
- Colunas: Destinatário, Template, Status, Data
- Filtro por status e por campanha
- Auto-refresh a cada 30s

## 4. Campo de e-mail nos contatos

A tabela `conversations` não tem campo de e-mail. Duas opções:
- Adicionar coluna `email` na tabela `conversations`
- Usar a tabela `transactions` que já tem `customer_email`

Vou adicionar `email` à tabela `conversations` para ser mais direto. Isso permite editar o e-mail na página de Contatos.

## 5. Configuração SMTP nas Settings

Na aba "Aplicação" das configurações, adicionar seção "E-mail SMTP":
- Campos: Host, Porta, Usuário, Senha, E-mail remetente
- Salvar na tabela `profiles` (novas colunas) ou em uma tabela `smtp_config` dedicada
- O backend lê essas configurações do banco ao enviar

Melhor: criar tabela `smtp_config` (`id`, `user_id`, `host`, `port`, `username`, `password`, `from_email`, `from_name`).

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `deploy/init-db.sql` | Adicionar tabelas `email_templates`, `email_campaigns`, `email_sends`, `smtp_config`, coluna `email` em `conversations` |
| `deploy/update.sh` | Incluir migrations das novas tabelas |
| `deploy/backend/package.json` | Adicionar `nodemailer` |
| `deploy/backend/src/routes/email.ts` | Nova rota com endpoints send + campaign |
| `deploy/backend/src/index.ts` | Registrar rota `/api/email` |
| `src/pages/EmailPage.tsx` | Nova página com 3 abas |
| `src/hooks/useEmailTemplates.ts` | CRUD de templates |
| `src/hooks/useEmailCampaigns.ts` | Gestão de campanhas |
| `src/hooks/useEmailSends.ts` | Histórico de envios |
| `src/hooks/useSmtpConfig.ts` | Config SMTP |
| `src/components/AppSidebar.tsx` | Adicionar item "E-mail" |
| `src/App.tsx` | Adicionar rota `/email` |
| `src/components/settings/AppSection.tsx` | Seção de configuração SMTP |
| Migração Supabase | Tabelas + RLS + coluna email |

## Fluxo resumido

```text
Usuário configura SMTP (Settings)
         │
         ▼
Cria template de e-mail (aba Templates)
         │
         ▼
Cria campanha: escolhe template + tag (aba Campanhas)
         │
         ▼
Clica "Enviar" → backend busca contatos com aquela tag
         │
         ▼
Backend envia via SMTP com delay entre cada um
         │
         ▼
Cada envio registrado em email_sends
         │
         ▼
Histórico visível na aba Histórico
```

