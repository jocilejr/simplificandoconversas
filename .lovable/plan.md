

# Fix: Envio em massa via webhook com fila de processamento

## Problema
O n8n envia 7.710 requisições simultâneas para `/api/email/webhook/inbound` com evento `register_email`. Cada requisição tenta abrir uma conexão SMTP e enviar o e-mail **inline** (dentro da própria request). Com milhares de conexões simultâneas, o servidor SMTP da Hostinger rejeita/ignora a maioria silenciosamente.

O endpoint de campanha (`/campaign`) já resolve isso corretamente: responde imediatamente e envia os e-mails em background com delay de 3s entre cada um. Mas o webhook `register_email` não tem essa proteção.

## Solução
Separar o registro do contato (síncrono) do envio do e-mail (assíncrono com fila). O webhook continuará respondendo `{ ok: true }` imediatamente, mas os e-mails serão enfileirados em uma tabela `email_queue` e processados por um cron job com delay de 3s entre envios.

## Arquivos a modificar

### 1. Migração SQL — criar tabela `email_queue`
```sql
CREATE TABLE public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES email_campaigns(id),
  template_id uuid REFERENCES email_templates(id),
  smtp_config_id uuid,
  recipient_email text NOT NULL,
  recipient_name text,
  personalization jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX idx_email_queue_pending ON email_queue(status, created_at) WHERE status = 'pending';
```

### 2. `deploy/backend/src/routes/email.ts` — register_email
No bloco auto-send (linhas ~803-914), em vez de enviar o e-mail diretamente, inserir na `email_queue`:
- Manter a verificação de suppression
- Inserir na fila com os dados necessários (campaign_id, template_id, smtp_config_id, recipient, personalization)
- Remover toda a lógica de createTransporter/sendMail do webhook

### 3. `deploy/backend/src/routes/email.ts` — novo endpoint `POST /process-queue`
Criar endpoint que:
- Busca até 50 itens pendentes da `email_queue` ordenados por `created_at`
- Para cada item: carrega template, monta HTML, envia via SMTP, atualiza status
- Delay de 3s entre cada envio (igual ao campaign)
- Atualiza contadores da campanha

### 4. `deploy/backend/src/index.ts` — adicionar cron job
Adicionar cron a cada 30 segundos para chamar o endpoint `/api/email/process-queue` (similar ao check-timeouts).

## Fluxo após a mudança

```text
n8n (7710 requests)
  → webhook register_email (responde OK + insere na email_queue)
  → cron a cada 30s processa 50 itens da fila com 3s de delay
  → ~16 e-mails/min = 7710 em ~8 horas (seguro para SMTP)
```

## Detalhes técnicos
- O delay de 3s entre envios previne bloqueio pelo SMTP da Hostinger
- A fila é persistente (sobrevive a restarts do container)
- O cron processa 50 por ciclo; com 30s de intervalo e 3s de delay, não há sobreposição
- Os contatos continuam sendo registrados instantaneamente (o upsert é síncrono)
- O `update.sh` na VPS precisará incluir o `ALTER TABLE` para criar a `email_queue`

