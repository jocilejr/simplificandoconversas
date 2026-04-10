

## Plano: Corrigir CORS da página pública de membros

### Causa raiz
A página pública em `membros.origemdavida.online` chama `apiUrl("member-access/...")` que resolve para `https://api.chatbotsimplificado.com/functions/v1/member-access/...`. O Nginx do API_DOMAIN retorna `Access-Control-Allow-Origin: https://app.chatbotsimplificado.com`, que não corresponde à origem `membros.origemdavida.online` — bloqueio de CORS.

O domínio de membros (`MEMBER_DOMAIN`) já possui proxy próprio em `/api/member-access/` no Nginx (linhas 73-78 da config). Ou seja, a chamada deveria ser **relativa** (`/api/member-access/...`), não absoluta para o API_DOMAIN.

### Correção

**1. `src/pages/MemberAccess.tsx`** — usar URL relativa para o endpoint de member-access em vez de `apiUrl()`:

```typescript
// ANTES
const response = await fetch(apiUrl(`member-access/${digits}`));

// DEPOIS
const response = await fetch(`/api/member-access/${digits}`);
```

Isso faz a requisição bater no próprio domínio (`membros.origemdavida.online/api/member-access/...`), onde o Nginx do MEMBER_DOMAIN já faz proxy para o backend — sem problema de CORS.

**2. Também verificar** se há outras chamadas `apiUrl()` ou chamadas ao Supabase client (`supabase.from(...)`, `supabase.rpc(...)`, `supabase.functions.invoke(...)`) no `MemberAccess.tsx` que possam sofrer o mesmo bloqueio. Se houver, precisaremos adicionar o `MEMBER_DOMAIN` ao CORS do API_DOMAIN no Nginx, ou criar proxies adicionais no bloco do MEMBER_DOMAIN.

### Verificação na VPS após deploy
```bash
# Testar se a chamada relativa funciona
curl -I "https://membros.origemdavida.online/api/member-access/5589981340810"
```

