

# Plano: Integração Completa Bidirecional via API + Webhooks

## Situação Atual

**O que já existe:**
- API REST em `/api/platform/` com endpoints de consulta e escrita (contatos, transações, tags, lembretes, mensagens)
- Webhook de entrada em `/api/external-messaging-webhook` que aceita eventos da app externa (pagamentos, contatos, tags, lembretes)
- Campo `webhook_url` nas configurações para callback
- Forward de `reminder_updated` no PATCH de lembretes → webhook externo
- Frontend faz `forwardToVps` no toggle de lembrete

**O que falta:**
- Backend NÃO envia webhook para a app externa ao **criar** ou **deletar** lembretes
- Backend NÃO envia webhook ao alterar **transações** (criar, atualizar status)
- Backend NÃO envia webhook ao alterar **contatos** ou **tags**
- Não existe endpoint `DELETE /api/platform/reminders/:id`
- Frontend NÃO notifica a VPS ao criar ou deletar lembretes

---

## O que será feito

### 1. Criar função utilitária `sendWebhook`

**Arquivo:** `deploy/backend/src/routes/platform-api.ts`

Extrair uma função reutilizável que busca o `webhook_url` e faz POST fire-and-forget:

```typescript
async function sendWebhook(userId: string, payload: object) {
  const sb = getServiceClient();
  const { data: conn } = await sb
    .from("platform_connections")
    .select("credentials")
    .eq("user_id", userId)
    .eq("platform", "custom_api")
    .maybeSingle();
  const url = conn?.credentials?.webhook_url;
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(err => console.error("Webhook error:", err.message));
}
```

### 2. Adicionar webhooks de saída em TODOS os endpoints de escrita

**Arquivo:** `deploy/backend/src/routes/platform-api.ts`

Após cada operação de escrita bem-sucedida, chamar `sendWebhook` com o evento correspondente:

| Endpoint | Evento enviado |
|---|---|
| `POST /reminders` | `reminder_created` |
| `PATCH /reminders/:id` | `reminder_updated` (já existe, refatorar para usar `sendWebhook`) |
| `DELETE /reminders/:id` (**novo**) | `reminder_deleted` |
| `POST /transactions` | `transaction_created` |
| `PATCH /transactions/:id` | `transaction_updated` |
| `POST /contacts` | `contact_created` ou `contact_updated` |
| `POST /tags` | `tag_added` |
| `DELETE /tags` | `tag_removed` |
| `POST /send-message` | `message_sent` |

### 3. Criar endpoint `DELETE /api/platform/reminders/:id`

**Arquivo:** `deploy/backend/src/routes/platform-api.ts`

Novo endpoint que deleta o lembrete do banco e envia `reminder_deleted` via webhook.

### 4. Frontend: notificar VPS em create e delete de lembretes

**Arquivo:** `src/hooks/useReminders.ts`

- Generalizar `forwardToVps` para aceitar método (POST/PATCH/DELETE) e dados
- No `onSuccess` de `useCreateReminder`: chamar `POST /api/platform/reminders` na VPS
- No `onSuccess` de `useDeleteReminder`: chamar `DELETE /api/platform/reminders/:id` na VPS
- Manter o toggle (PATCH) como está

### 5. Gerar relatório de integração para a app externa

Após implementar, será gerado um **documento completo** (markdown ou PDF) com tudo que a app externa precisa implementar: endpoints para consumir, payloads dos webhooks que vai receber, e formato dos webhooks que deve enviar.

---

## Payload padrão dos webhooks de saída

Todos os webhooks enviados para o `webhook_url` seguem este formato:

```json
{
  "event": "reminder_created | reminder_updated | reminder_deleted | transaction_created | ...",
  "timestamp": "2026-03-30T12:00:00Z",
  "data": { /* objeto completo do registro */ }
}
```

## Arquivos alterados
1. `deploy/backend/src/routes/platform-api.ts` — função `sendWebhook`, webhook em todos os endpoints de escrita, novo `DELETE /reminders/:id`
2. `src/hooks/useReminders.ts` — forward em create/delete
3. Relatório gerado em `/mnt/documents/` com instruções para a app externa

