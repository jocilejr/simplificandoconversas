

# Métricas individuais por template + envio manual de teste

## O que será feito

1. **Taxa de abertura por template** — cada card de template exibirá métricas: total de envios, aberturas e taxa de abertura (%). Os dados vêm de uma query em `email_sends` agrupada por `template_id`, cruzando com `opened_at IS NOT NULL`.

2. **Envio manual de teste** — botão em cada template card para enviar o template a um contato específico. Um dialog permite digitar o e-mail do destinatário (com autocomplete dos contatos existentes) e enviar via `/api/email/send`.

## Arquivos alterados

### 1. `src/hooks/useEmailTemplates.ts`

- Adicionar query separada para buscar métricas por template:
  ```sql
  SELECT template_id, 
    COUNT(*) as total_sent, 
    COUNT(opened_at) as total_opened
  FROM email_sends 
  WHERE user_id = ? AND template_id IS NOT NULL
  GROUP BY template_id
  ```
- Retornar `templateStats` como `Record<templateId, { sent, opened, openRate }>`

### 2. `src/components/email/EmailTemplatesTab.tsx`

**Métricas no card:**
- Abaixo do nome/assunto, exibir uma linha com: `Enviados: X | Aberturas: Y (Z%)`
- Usar badges ou texto pequeno estilizado

**Botão de envio manual:**
- Adicionar ícone `Send` nos botões de ação do card (junto com preview, duplicar, editar, excluir)
- Ao clicar, abrir dialog com:
  - Input de e-mail do destinatário (com sugestões dos contatos existentes via `email_contacts`)
  - Input opcional de nome do destinatário
  - Botão "Enviar"
- O envio chama `/api/email/send` com `{ to, subject: t.subject, html: t.html_body, userId, templateId: t.id, recipientName }`
- As variáveis `{{nome}}`, `{{email}}` são substituídas pelos dados informados antes do envio

## Fluxo do envio manual

1. Clica no ícone Send no card do template
2. Dialog abre com campo de e-mail e nome
3. Ao enviar, as variáveis do HTML são substituídas
4. POST para `/api/email/send` com o HTML processado
5. Toast de sucesso/erro
6. Métricas do template atualizam automaticamente (refetch)

## Sem mudanças de backend ou banco

Todas as queries usam tabelas existentes (`email_sends`, `email_contacts`). O endpoint `/api/email/send` já suporta `templateId`. Nenhuma migration necessária.

