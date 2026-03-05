

## Plano: Ativar todos os eventos de webhook da Evolution API

### Problema
Atualmente, apenas 8 eventos estão configurados nos webhooks (`MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `SEND_MESSAGE`, `CONTACTS_SET`, `CONTACTS_UPSERT`, `CONTACTS_UPDATE`, `QRCODE_UPDATED`, `CONNECTION_UPDATE`). Eventos importantes como `MESSAGES_SET`, `MESSAGES_DELETE`, `CHATS_SET`, `CHATS_DELETE`, `PRESENCE_UPDATE`, `LABELS_ASSOCIATION`, `LABELS_EDIT`, `CALL`, `LOGOUT_INSTANCE`, `REMOVE_INSTANCE` e `APPLICATION_STARTUP` estão faltando.

### Correção

**Arquivo:** `supabase/functions/evolution-proxy/index.ts`

Atualizar a lista de eventos em **3 locais** (set-webhook, sync-webhooks, sync-chats) para incluir todos os eventos disponíveis da Evolution API:

```
"APPLICATION_STARTUP",
"QRCODE_UPDATED",
"CONNECTION_UPDATE",
"MESSAGES_SET",
"MESSAGES_UPSERT",
"MESSAGES_UPDATE",
"MESSAGES_DELETE",
"SEND_MESSAGE",
"CONTACTS_SET",
"CONTACTS_UPSERT",
"CONTACTS_UPDATE",
"PRESENCE_UPDATE",
"CHATS_SET",
"CHATS_DELETE",
"CHATS_UPDATE",
"LABELS_EDIT",
"LABELS_ASSOCIATION",
"CALL",
"TYPEBOT_CHANGE_STATUS",
"LOGOUT_INSTANCE",
"REMOVE_INSTANCE"
```

Extrair a lista para uma constante `ALL_WEBHOOK_EVENTS` no topo do arquivo para evitar duplicação e facilitar manutenção futura.

