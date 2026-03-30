

# Plano: Mover envio de webhook para o backend (resolver CORS)

## Problema
O `sendWebhookToExternal` no frontend faz `fetch()` direto do navegador para a URL da app externa. Se a app externa não retorna headers CORS (`Access-Control-Allow-Origin`), o navegador bloqueia a requisição silenciosamente. O `catch(() => {})` esconde o erro.

## Solução
Criar um endpoint no backend da VPS (`POST /api/platform/webhook-notify`) que recebe o evento do frontend e faz o relay para a app externa server-side (sem restrição CORS).

### 1. Backend: novo endpoint em `deploy/backend/src/routes/platform-api.ts`

Adicionar rota `POST /api/platform/webhook-notify`:
- Recebe `{ event, data }` do frontend
- Busca `platform_connections` com `platform = "external_app"` usando o `user_id` do token
- Envia POST para `webhook_url` com `X-API-Key`
- Retorna 200/500 com log

### 2. Frontend: `src/hooks/useReminders.ts`

Alterar `sendWebhookToExternal` para chamar o backend da VPS em vez de fazer fetch direto:

```typescript
async function sendWebhookToExternal(event: string, data: object) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const origin = window.location.origin;
    const apiBase = origin.includes("localhost") 
      ? "http://localhost:3001" 
      : origin;

    fetch(`${apiBase}/api/platform/webhook-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ event, data }),
    }).catch(() => {});
  } catch {}
}
```

### 3. Backend handler

```typescript
// Em platform-api.ts, dentro do router
router.post("/webhook-notify", async (req, res) => {
  const userId = req.userId; // já extraído pelo middleware de auth
  const { event, data } = req.body;
  await sendWebhook(userId, event, data);
  res.json({ ok: true });
});
```

## Resultado
- O webhook é enviado pelo servidor (sem CORS)
- O frontend faz uma chamada fire-and-forget para o próprio backend
- Funciona em qualquer configuração de app externa

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `deploy/backend/src/routes/platform-api.ts` | Adicionar rota `POST /webhook-notify` |
| `src/hooks/useReminders.ts` | `sendWebhookToExternal` chama backend em vez de app externa direta |

