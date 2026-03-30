

# Plano: Adicionar eventos de lembretes ao webhook externo

## Contexto
A aplicação externa já foi atualizada para enviar webhooks com eventos de lembretes. O backend precisa processar esses eventos no `external-webhook.ts`.

## O que será alterado

### Arquivo: `deploy/backend/src/routes/external-webhook.ts`

Adicionar tratamento para 3 novos eventos após a seção existente (seção 5):

**Seção 6 — Eventos de lembretes:**

- **`reminder_updated` / `sync_reminder`**: Atualizar o lembrete pelo `id` no banco. Campos aceitos: `completed`, `title`, `description`, `due_date`. Update com `user_id = userId` para segurança.
- **`reminder_deleted`**: Deletar o lembrete pelo `id` com `user_id = userId`.

Payload esperado:
```json
{
  "event": "reminder_updated",
  "id": "uuid-do-lembrete",
  "completed": true,
  "title": "...",
  "description": "..."
}
```

Atualizar também o JSDoc do endpoint com os novos eventos.

### Arquivo: `src/hooks/useReminders.ts`

Remover o código de sincronização PATCH do `onSuccess` do `useToggleReminder`, já que agora a comunicação é unidirecional (externa → API) e o DB já é atualizado diretamente pelo frontend. O PATCH externo não funciona porque o frontend não tem acesso à API externa.

## Resultado
- Webhook aceita `sync_reminder`, `reminder_updated`, `reminder_deleted`
- Atualização do banco local via webhook com segurança (filtrando por `user_id`)
- Realtime propaga mudanças automaticamente para a UI

