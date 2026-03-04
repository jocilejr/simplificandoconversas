

## Plano: Auto-configurar webhook ao vincular instância

### Problema
Quando uma instância existente é vinculada ao app (via "Buscar Instâncias" ou "Ativar"), o webhook não é configurado automaticamente. Apenas instâncias **criadas** pelo app recebem o webhook (no `create-instance`). Instâncias importadas ficam sem webhook, não recebendo mensagens.

### Solução

#### 1. Criar action `set-webhook` no `evolution-proxy/index.ts`
Adicionar um novo case no switch que chama a Evolution API para configurar o webhook de uma instância:

```typescript
case "set-webhook": {
  const { instanceName: whInstName } = params;
  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-webhook`;
  const resp = await fetch(`${baseUrl}/webhook/set/${whInstName}`, {
    method: "POST",
    headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: true,
      events: [
        "MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE",
        "CONTACTS_SET", "CONTACTS_UPSERT", "CONTACTS_UPDATE",
        "QRCODE_UPDATED", "CONNECTION_UPDATE",
      ],
    }),
  });
  result = await resp.json();
  break;
}
```

Adicionar `"set-webhook"` à lista `noInstanceActions`.

#### 2. Chamar `set-webhook` automaticamente no `setActiveInstance` (hook)
Em `useEvolutionInstances.ts`, após o upsert da instância no banco, chamar `set-webhook` via edge function para garantir que o webhook é configurado:

```typescript
// After upsert, configure webhook
await supabase.functions.invoke("evolution-proxy", {
  body: { action: "set-webhook", instanceName },
});
```

### Arquivos a editar
- `supabase/functions/evolution-proxy/index.ts` — novo case `set-webhook` + adicionar na lista `noInstanceActions`
- `src/hooks/useEvolutionInstances.ts` — chamar `set-webhook` no `setActiveInstance`

