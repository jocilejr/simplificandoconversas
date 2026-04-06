# Campanhas automáticas por tag + correção do seletor de tags

## Problemas identificados

1. **Seletor de tags vazio**: O dropdown de tags na criação de campanha consulta a tabela `contact_tags` (contatos do WhatsApp). Mas os contatos de e-mail armazenam tags no campo `email_contacts.tags` (array). A tag "lead-grupo-rafael" está em `email_contacts.tags`, não em `contact_tags`, por isso não aparece no seletor.
2. **Envio apenas manual**: Hoje a campanha só envia quando o usuário clica "Enviar". O usuário quer que, ao receber um contato com uma tag específica (ou ao adicionar uma tag a um contato existente), a campanha associada àquela tag dispare automaticamente.
3. **Backend ignora tag_filter para email_contacts**: Na hora de enviar a campanha, o `tag_filter` só filtra pela tabela `contact_tags` (WhatsApp). Os `email_contacts` são adicionados sem filtro de tag.

## Solução

### 1. Corrigir o seletor de tags (Frontend)

**Arquivo**: `src/components/email/EmailCampaignsTab.tsx`

- Trocar a query de `contact_tags` para `email_contacts`, extraindo tags únicas do campo `tags` (array)
- Usar algo como: buscar todos os `email_contacts` do usuário, fazer `flatMap` das tags, deduplicar e ordenar

### 2. Adicionar campo `auto_send` à campanha

**Migração SQL**:

- Adicionar coluna `auto_send boolean default false` à tabela `email_campaigns`
- Quando `auto_send = true` e a campanha tem `tag_filter`, o backend envia automaticamente ao receber um contato com aquela tag

### 3. Adicionar toggle "Envio automático" no formulário de campanha (Frontend)

**Arquivo**: `src/components/email/EmailCampaignsTab.tsx`

- Switch/checkbox ao lado do filtro de tag
- Quando ativado, a campanha fica em modo "escuta": qualquer contato que chegar com aquela tag recebe o e-mail automaticamente
- Visualmente, campanhas automáticas ficam com status "Automática" em vez de "Rascunho"

### 4. Disparar campanha automática no webhook `register_email` (Backend)

**Arquivo**: `deploy/backend/src/routes/email.ts`

- Após o upsert do contato no `register_email`, verificar se as tags do contato coincidem com alguma campanha que tenha `auto_send = true` e `tag_filter` correspondente
- Se sim, enviar o template da campanha para esse contato específico (não para toda a base)
- Registrar o envio no `email_sends` normalmente
- Também agendar follow-ups se a campanha tiver

### 5. Corrigir filtro de tag no envio em massa (Backend)

**Arquivo**: `deploy/backend/src/routes/email.ts`

- Na rota `POST /api/email/campaign`, quando há `tag_filter`, também filtrar `email_contacts` por tag (verificar se o array `tags` contém a tag)
- Hoje o código busca todos os `email_contacts` sem filtrar por tag

## Fluxo final

```text
Webhook register_email (tag: "lead-grupo-rafael")
  ↓
  Salva/atualiza email_contacts
  ↓
  Busca campanhas com auto_send=true e tag_filter="lead-grupo-rafael"
  ↓
  Para cada campanha encontrada:
    → Envia o template ao contato
    → Agenda follow-ups se houver
    → Registra no email_sends
```

## Arquivos modificados

1. **Migração SQL** — adicionar `auto_send` à tabela `email_campaigns`
2. `src/components/email/EmailCampaignsTab.tsx` — seletor de tags + toggle de envio automático
3. `src/hooks/useEmailCampaigns.ts` — incluir `auto_send` no mutation de criação
4. `deploy/backend/src/routes/email.ts` — lógica de auto-envio no `register_email` + filtro de tag correto no envio em massa  
  
  
  
NOVA IDEIA: INSIRA UMA ABA ONDE EU CONSIGO VISUALIZAR AS TAGS DISPONÍVEIS E APAGAR AS QUE EU NÃO TIVER INTERESSE. AO APAGAR ELE VAI DELETAR DE TODOS OS CONTATOS EXISTENTE AQUELA TAG. O CONTATO DEVE PERMANECER, MAS A TAG DEVERÁ SER DELETADA