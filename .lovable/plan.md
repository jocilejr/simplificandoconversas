

# Plano: Corrigir webhooks de saída (app principal → app externa)

## Problema identificado

Existem **duas desconexões** que impedem a comunicação de saída:

1. **Backend (`sendWebhook`)**: busca `webhook_url` em `platform_connections` com `platform = "custom_api"`, mas a aba "App Externa" salva as credenciais com `platform = "external_app"`. Resultado: `webhook_url` nunca é encontrada, webhook nunca é enviado.

2. **Frontend (`forwardToVps`)**: depende de `app_public_url` do profile (que está `null`) e da `api_key` de `custom_api`. Mesmo que funcionasse, faz a chamada do **navegador do usuário** direto para a VPS, o que é frágil (CORS, rede).

## Solução

### 1. Backend: `sendWebhook` buscar em `external_app`

**Arquivo:** `deploy/backend/src/routes/platform-api.ts`

Alterar a função `sendWebhook` para buscar o `webhook_url` em `platform = "external_app"` (onde a aba App Externa salva). Também enviar a `api_key` configurada no header para autenticar na app externa.

```typescript
async function sendWebhook(userId: string, event: string, data: object) {
  try {
    const sb = getServiceClient();
    // Buscar credenciais da app externa (não custom_api)
    const { data: conn } = await sb
      .from("platform_connections")
      .select("credentials")
      .eq("user_id", userId)
      .eq("platform", "external_app")
      .maybeSingle();

    const creds = conn?.credentials as any;
    const url = creds?.webhook_url;
    if (!url) return;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (creds?.api_key) headers["X-API-Key"] = creds.api_key;

    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ event, timestamp: new Date().toISOString(), data }),
    }).catch(...);
  } catch ...
}
```

### 2. Frontend: remover `forwardToVps`, usar backend como relay

**Arquivo:** `src/hooks/useReminders.ts`

Remover `getVpsConfig` e `forwardToVps` completamente. O backend já envia os webhooks via `sendWebhook` quando os endpoints da Platform API são chamados. As ações da UI (criar, toggle, deletar) já escrevem direto no banco, e o backend já dispara os webhooks nos endpoints REST. O frontend não precisa fazer forward manual.

Se a UI escreve direto no Supabase (sem passar pela Platform API), os webhooks não disparam. Para resolver isso de forma limpa, vou fazer o frontend chamar a VPS Platform API em vez de escrever direto no Supabase, ou alternativamente, manter o write direto e adicionar uma chamada fire-and-forget para o backend notificar a app externa.

**Abordagem escolhida:** Manter o write direto no Supabase (mais rápido para a UI) e adicionar uma chamada `POST /api/platform/notify` no backend que apenas dispara o webhook sem duplicar o write. Isso é mais simples que mudar toda a lógica de mutations.

Na verdade, a abordagem mais simples: o `forwardToVps` já tenta chamar os endpoints da Platform API na VPS, que por sua vez chamam `sendWebhook`. O problema é que `getVpsConfig` busca `app_public_url` (null) e `custom_api` api_key. Basta mudar para buscar de `external_app` as credenciais corretas, e usar a `base_url` configurada na aba App Externa como destino... mas espera, o `forwardToVps` chama a **própria VPS** (não a app externa), para que a VPS dispare o webhook. O problema é que o `app_public_url` está null.

**Solução real para o frontend:** mudar `getVpsConfig` para buscar `app_public_url` do profile OU, melhor ainda, fazer o backend disparar webhooks automaticamente via um trigger/cron, ou simplesmente fazer o frontend chamar um endpoint dedicado na própria VPS para notificar.

A forma mais prática: o frontend já escreve no Supabase. O backend pode usar um **Postgres trigger + pg_notify** ou simplesmente: ao salvar no Supabase, o frontend faz um POST fire-and-forget para `{VPS_URL}/api/platform/webhook-relay` com o evento. Mas isso requer que o frontend conheça a URL da VPS.

**Decisão final simplificada:**

O `forwardToVps` deveria usar a URL da própria VPS. O campo `app_public_url` no profile serve para isso mas está null. Vou mudar para que o frontend use a URL da aba "Aplicação" (campo `app_public_url` das configurações), e se não existir, tente derivar do `window.location` (já que na VPS o frontend é servido pela mesma VPS).

### Resumo das alterações

| Arquivo | O que muda |
|---|---|
| `deploy/backend/src/routes/platform-api.ts` | `sendWebhook` busca `external_app` em vez de `custom_api`, envia `X-API-Key` |
| `src/hooks/useReminders.ts` | `getVpsConfig` usa `window.location.origin` como fallback para URL da VPS, remove dependência de `app_public_url` null |

### Resultado

- Quando o backend processa qualquer escrita via Platform API, o webhook é enviado para a app externa com autenticação
- Quando a UI faz ações (criar/toggle/deletar lembrete), o frontend notifica a VPS, que por sua vez envia o webhook para a app externa

