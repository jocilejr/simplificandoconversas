

## Correção: Usar URL pública em ambos os locais de geração de link

### Problema
O arquivo `execute-flow/index.ts` tem **duas** ocorrências de construção do `trackingUrl`. A primeira (linha ~420) foi corrigida para usar `app_public_url`, mas a segunda (linha 504) ainda usa `Deno.env.get("SUPABASE_URL")/functions/v1/link-redirect?code=...`.

### Correção
Linha 504 — substituir:
```typescript
const trackingUrl = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/link-redirect?code=${shortCode}`;
```
por:
```typescript
const publicUrl = profile.app_public_url?.replace(/\/$/, "");
const trackingUrl = publicUrl
  ? `${publicUrl}/r/${shortCode}`
  : `${Deno.env.get("SUPABASE_URL")!}/functions/v1/link-redirect?code=${shortCode}`;
```

### Arquivo editado
- `supabase/functions/execute-flow/index.ts` (linha 504)

