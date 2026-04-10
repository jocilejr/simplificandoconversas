

## Plano: Corrigir CORS do Storage para upload de imagens

### Causa raiz
O Supabase JS client envia o header `x-upsert` nas requisições de upload ao Storage. O bloco `/storage/v1/` no Nginx (linha 161) não lista esse header no `Access-Control-Allow-Headers`, fazendo o preflight (OPTIONS) falhar.

### Correção

**Arquivo:** `deploy/nginx/default.conf.template`

**Linha 161** — Adicionar `x-upsert` à lista de headers permitidos no bloco `/storage/v1/`:

```
'authorization, x-client-info, apikey, content-type, accept, accept-profile, content-profile, x-supabase-api-version, prefer, range, x-upsert'
```

Essa mesma alteração se aplica tanto no OPTIONS (linha 161) quanto é suficiente porque os demais headers de resposta já são tratados pelo `proxy_hide_header` + `add_header`.

### Após deploy

Na VPS, reiniciar o Nginx:
```bash
docker compose restart nginx
```

