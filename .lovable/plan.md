

# Plano: Enviar webhook direto para app externa quando lembrete mudar

## Problema
O `forwardToVps` no frontend busca credenciais de `custom_api` (que pode não existir) e depende de `app_public_url` (que está `null`). O webhook nunca chega na app externa quando a UI altera lembretes.

## Solução
Substituir o `forwardToVps` por uma função `sendWebhookToExternal` que lê as credenciais de `external_app` (onde a aba "App Externa" salva) e envia o webhook **direto** para o `webhook_url` configurado, sem precisar passar pela VPS como relay.

## Arquivo: `src/hooks/useReminders.ts`

Remover `getVpsConfig` e `forwardToVps`. Criar:

```typescript
async function sendWebhookToExternal(event: string, data: object) {
  try {
    const { data: conn } = await (supabase as any)
      .from("platform_connections")
      .select("credentials")
      .eq("platform", "external_app")
      .maybeSingle();

    const creds = conn?.credentials;
    const url = creds?.webhook_url;
    if (!url) return;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (creds?.api_key) headers["X-API-Key"] = creds.api_key;

    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ event, timestamp: new Date().toISOString(), data }),
    }).catch(() => {});
  } catch {}
}
```

Atualizar as mutations:
- `useCreateReminder` `onSuccess` → `sendWebhookToExternal("reminder_created", data)`
- `useToggleReminder` `onSuccess` → `sendWebhookToExternal("reminder_updated", { id, completed })`
- `useDeleteReminder` `onSuccess` → `sendWebhookToExternal("reminder_deleted", { id })`

## Resultado
- Quando o status de um lembrete muda pela UI, o webhook é enviado direto para a app externa
- Usa as mesmas credenciais da aba "App Externa"
- Sem cron, sem relay pela VPS, sem dependência de `app_public_url`

