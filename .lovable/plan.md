

## Problema

O `MediaManagerSection.tsx` faz fetch com headers customizados:
```
x-user-id: ...
x-workspace-id: ...
```

Mas o bloco CORS do Nginx para `/functions/v1/` (linha 331) só permite:
```
authorization, x-client-info, apikey, content-type, accept, accept-profile, content-profile, x-supabase-api-version, prefer, range
```

O browser faz um preflight OPTIONS, o Nginx responde sem aceitar `x-user-id` / `x-workspace-id`, e o browser bloqueia a requisição → "Failed to fetch".

## Solução

Adicionar `x-user-id, x-workspace-id` à lista de headers permitidos no CORS do Nginx, no bloco `/functions/v1/` do API_DOMAIN.

### Arquivo: `deploy/nginx/default.conf.template`

Na linha 331, alterar de:
```
'authorization, x-client-info, apikey, content-type, accept, accept-profile, content-profile, x-supabase-api-version, prefer, range'
```

Para:
```
'authorization, x-client-info, apikey, content-type, accept, accept-profile, content-profile, x-supabase-api-version, prefer, range, x-user-id, x-workspace-id'
```

### Após o deploy

Na VPS, rodar:
```bash
cd ~/simplificandoconversas/deploy && bash update.sh
```

Isso vai rebuildar o Nginx com os novos headers CORS e o Gerenciador de Arquivos vai funcionar.

