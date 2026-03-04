

## Problema: URLs públicas SPA não podem servir OG tags dinâmicas

### Causa raiz

A URL `simplificandoconversas.lovable.app/r/CODE` serve o `index.html` estático da SPA. Crawlers do WhatsApp **não executam JavaScript**, então eles leem apenas as meta tags estáticas do `index.html` (genéricas do app) — nunca chegam à edge function que tem os dados de preview por link.

A edge function `link-redirect` já serve OG tags dinâmicas corretamente (título, descrição, imagem por link). O componente `LinkRedirect.tsx` faz `window.location.href = edgeFunctionUrl`, mas isso só funciona para humanos com JS ativado.

### Conflito fundamental

- **URL pública SPA** → hosting estático, impossível servir HTML dinâmico por rota
- **Edge function** → serve OG tags dinâmicas corretamente, mas URL é do Supabase

### Solução: Sempre usar a edge function como URL de tracking

Reverter ambas as ocorrências em `execute-flow/index.ts` para usar a URL da edge function. Essa é a **única forma** de garantir previews com título, descrição e imagem personalizados no WhatsApp, porque o crawler precisa receber HTML server-side.

```typescript
const trackingUrl = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/link-redirect?code=${shortCode}`;
```

A rota SPA `/r/:code` continua funcionando como fallback para humanos que acessem a URL de outra forma, redirecionando para a edge function.

### Alterações

**`supabase/functions/execute-flow/index.ts`** — reverter as duas ocorrências de `trackingUrl` (linhas ~420 e ~504) para sempre usar a URL da edge function, removendo a lógica condicional de `app_public_url`.

### Alternativa futura

Para ter URLs bonitas COM OG previews, seria necessário um domínio customizado com proxy reverso (ex: Cloudflare Worker) que intercepte `/r/*` e encaminhe para a edge function. Isso está fora do escopo atual.

