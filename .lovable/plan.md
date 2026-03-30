

# Plano: Corrigir URL da sincronização externa de lembretes

## Problema
O `app_public_url` no banco é `https://app.chatbotsimplificado.com` (domínio do frontend), mas os endpoints da API REST ficam em `https://api.chatbotsimplificado.com`. A chamada PATCH vai para o domínio errado e falha silenciosamente.

## Solução

Duas opções:

**Opção A — Corrigir o valor no banco**: Atualizar `app_public_url` para `https://api.chatbotsimplificado.com` na VPS. Sem mudança de código.

**Opção B (recomendada) — Derivar o domínio da API no código**: Alterar `src/hooks/useReminders.ts` para substituir `app.` por `api.` na URL, ou usar a variável de ambiente `VITE_SUPABASE_URL` como base, garantindo que funcione independentemente do valor configurado.

### Implementação (Opção B)

**Arquivo**: `src/hooks/useReminders.ts`, linha 129

Trocar:
```ts
const url = `${baseUrl.replace(/\/$/, "")}/api/platform/reminders/${variables.id}`;
```

Por:
```ts
const apiUrl = baseUrl.replace(/\/$/, "").replace("://app.", "://api.");
const url = `${apiUrl}/api/platform/reminders/${variables.id}`;
```

Isso garante que mesmo com `app_public_url = https://app.chatbotsimplificado.com`, a requisição vá para `https://api.chatbotsimplificado.com/api/platform/reminders/{id}`.

## Escopo
- 1 arquivo alterado, 1 linha modificada
- Sem mudança de banco ou backend

