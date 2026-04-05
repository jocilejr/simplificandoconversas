

# Plano: Sistema Completo de E-mail Marketing

## O que existe hoje
- Templates com editor HTML simples (textarea)
- Campanhas básicas (filtro por tag, envio em massa)
- Histórico simples (tabela com status)
- Backend com envio via Nodemailer/SMTP
- Config SMTP nas Settings

## O que será adicionado/melhorado

### 1. Editor de Templates avançado
- Editor HTML com painel lado-a-lado: código + preview em tempo real (iframe)
- Barra de ferramentas com snippets prontos (botão CTA, imagem, divisor, espaçador, rodapé)
- Variáveis de personalização: `{{nome}}`, `{{email}}`, `{{telefone}}` com substituição automática no envio
- Duplicar template existente
- Enviar e-mail de teste com template selecionado (para o e-mail do remetente)

### 2. Campanhas de Follow-up
- Nova tabela `email_follow_ups` para sequências de follow-up vinculadas a uma campanha
- Ao criar campanha, poder adicionar etapas de follow-up:
  - Cada etapa: template + delay em dias (ex: "enviar template X 3 dias depois")
- Backend processa follow-ups via cron job (verifica diariamente quais follow-ups devem ser disparados)
- Status por destinatário: rastrear quem já recebeu cada etapa
- Possibilidade de cancelar follow-ups pendentes

### 3. Webhooks para eventos externos
- Nova rota `POST /api/email/webhook/inbound` para receber eventos de sistemas externos
  - Eventos suportados: `send_email` (dispara envio individual), `trigger_campaign` (inicia campanha), `add_to_campaign` (adiciona contato a uma campanha/follow-up)
  - Autenticação via header `X-API-Key` (mesma chave da Platform API)
  - Logs registrados em `api_request_logs`
- Nova rota `POST /api/email/webhook/events` para receber eventos de bounce/delivery do SMTP (se configurado)
- Nova coluna `bounce_count` e `last_bounced_at` na tabela de contatos ou em tabela separada `email_suppressions` para gerenciar reputação

### 4. Gestão de conexão SMTP melhorada
- Indicador visual de status da conexão SMTP (conectado/desconectado/erro)
- Verificação de conexão ao salvar config (tenta conectar ao servidor SMTP sem enviar)
- Suporte a múltiplas contas SMTP (ex: uma para transacional, outra para marketing)
- Nova tabela ou expansão de `smtp_config` para múltiplos servidores
- Seleção de servidor SMTP ao criar campanha

### 5. Histórico e Analytics completos
- Dashboard com cards de métricas: total enviados, entregues, falhas, taxa de abertura (via pixel tracking)
- Tracking pixel embutido automaticamente nos e-mails (imagem 1x1 que registra abertura)
- Nova tabela `email_events` para eventos granulares (sent, opened, bounced, failed)
- Nova rota `GET /api/email/track/:eventId` que registra abertura e retorna imagem transparente
- Filtros avançados no histórico: por data, campanha, template, status
- Paginação real no histórico
- Exportar histórico como CSV

### 6. Preview de HTML aprimorado
- Preview em iframe isolado (não dangerouslySetInnerHTML)
- Toggle desktop/mobile preview (larguras diferentes)
- Botão "Enviar preview para meu e-mail"

---

## Banco de dados — novas tabelas e alterações

**`email_follow_ups`** — Etapas de follow-up de campanhas
- `id`, `campaign_id` (FK), `user_id`, `template_id` (FK), `delay_days`, `step_order`, `created_at`

**`email_follow_up_sends`** — Rastreamento de follow-ups por destinatário
- `id`, `follow_up_id` (FK), `user_id`, `recipient_email`, `status`, `scheduled_at`, `sent_at`, `error_message`, `created_at`

**`email_events`** — Eventos granulares de cada envio
- `id`, `send_id` (FK para email_sends), `user_id`, `event_type` (sent/opened/bounced/failed), `metadata` (jsonb), `created_at`

**`email_suppressions`** — E-mails que devem ser ignorados (bounce/unsubscribe)
- `id`, `user_id`, `email`, `reason` (bounce/unsubscribe/complaint), `created_at`

**Alterações em `smtp_config`**: adicionar coluna `label` (text, default "Principal") para identificar múltiplas contas

**Alterações em `email_campaigns`**: adicionar colunas `smtp_config_id` (uuid nullable FK), `opened_count` (integer default 0)

**Alterações em `email_sends`**: adicionar coluna `opened_at` (timestamptz nullable)

---

## Backend — novos endpoints

| Endpoint | Descrição |
|---|---|
| `POST /api/email/webhook/inbound` | Recebe eventos externos (send_email, trigger_campaign, add_to_campaign) |
| `POST /api/email/webhook/events` | Recebe eventos de delivery/bounce |
| `GET /api/email/track/:sendId` | Pixel de tracking (registra abertura, retorna imagem 1x1) |
| `POST /api/email/preview` | Envia preview do template para o e-mail do remetente |
| `POST /api/email/verify-smtp` | Testa conexão SMTP sem enviar |
| `GET /api/email/stats` | Retorna métricas agregadas (enviados, abertos, falhas) |
| Cron: check follow-ups | A cada hora, verifica follow-ups pendentes e dispara |

---

## Frontend — componentes novos/alterados

| Componente | O que muda |
|---|---|
| `EmailTemplatesTab` | Editor side-by-side (código + preview iframe), barra de snippets, variáveis, duplicar, enviar teste |
| `EmailCampaignsTab` | Adicionar etapas de follow-up, selecionar SMTP, preview de destinatários com contagem |
| `EmailHistoryTab` | Dashboard com métricas, filtros avançados, paginação, exportar CSV |
| `SmtpSection` | Múltiplas contas, verificação de conexão, indicador de status |
| `EmailPage` | Nova aba "Webhooks" com documentação dos endpoints e logs de eventos recebidos |

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `deploy/backend/src/routes/email.ts` | Expandir com novos endpoints (webhook, tracking, stats, verify, preview, cron follow-ups) |
| `src/components/email/EmailTemplatesTab.tsx` | Reescrever com editor side-by-side e funcionalidades avançadas |
| `src/components/email/EmailCampaignsTab.tsx` | Adicionar follow-ups, seleção de SMTP |
| `src/components/email/EmailHistoryTab.tsx` | Dashboard com métricas, filtros, paginação |
| `src/components/email/EmailWebhooksTab.tsx` | **Novo** — documentação de webhooks + logs de eventos |
| `src/components/settings/SmtpSection.tsx` | Múltiplas contas SMTP, verificação de conexão |
| `src/pages/EmailPage.tsx` | Adicionar aba "Webhooks" |
| `src/hooks/useEmailTemplates.ts` | Adicionar duplicar e enviar teste |
| `src/hooks/useEmailCampaigns.ts` | Adicionar follow-ups |
| `src/hooks/useEmailSends.ts` | Adicionar filtros avançados, paginação, stats |
| `src/hooks/useSmtpConfig.ts` | Suporte a múltiplas contas |
| Migração Supabase | Novas tabelas + alterações |
| `deploy/update.sh` | Incluir novas migrations |

