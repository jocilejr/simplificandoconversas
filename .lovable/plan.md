

## Diagnostico: Erro 404 na Extensao Chrome

O problema e claro: o Nginx na VPS **nao tem um bloco `location`** para `/api/ext/`. A extensao chama `https://api.chatbotsimplificado.com/api/ext/dashboard`, mas o Nginx so tem rotas para `/functions/v1/`, `/rest/v1/`, `/auth/v1/`, etc. Qualquer caminho `/api/ext/*` cai no handler padrao do Nginx e retorna 404.

### Correcao

**Arquivo: `deploy/nginx/default.conf.template`**

Adicionar um bloco `location /api/ext/` no server do `API_DOMAIN` (antes do bloco `/functions/v1/`), proxying para `http://backend:3001/api/ext/`:

```nginx
# Chrome Extension API
location /api/ext/ {
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'authorization, content-type' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Max-Age' 86400;
        add_header 'Content-Length' 0;
        return 204;
    }
    proxy_hide_header 'Access-Control-Allow-Origin';
    proxy_hide_header 'Access-Control-Allow-Methods';
    proxy_hide_header 'Access-Control-Allow-Headers';
    proxy_hide_header 'Access-Control-Allow-Credentials';
    add_header 'Access-Control-Allow-Origin' $cors_origin always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    proxy_pass http://backend:3001/api/ext/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Apos o deploy, executar na VPS:
```bash
docker compose up -d --force-recreate nginx
```

**Apenas 1 arquivo alterado. Nenhuma mudanca no backend ou na extensao.**

