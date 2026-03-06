

## Problema

O erro CORS ocorre porque o Nginx no API_DOMAIN não adiciona headers CORS nas respostas. Quando o frontend em `app.chatbotsimplificado.com` faz requests para `api.chatbotsimplificado.com`, o browser bloqueia porque o preflight OPTIONS não recebe `Access-Control-Allow-Origin`.

## Solução

Adicionar headers CORS e tratamento de preflight OPTIONS no Nginx para todas as rotas do API_DOMAIN.

### Arquivo: `deploy/nginx/default.conf.template`

Adicionar um bloco de CORS no server do API_DOMAIN, antes de cada location, ou melhor, usar uma abordagem centralizada com variáveis:

```nginx
# ─── API (API_DOMAIN) ───
server {
    listen 80;
    server_name ${API_DOMAIN};
    client_max_body_size 50M;

    # CORS headers
    set $cors_origin "https://${APP_DOMAIN}";

    # PostgREST
    location /rest/v1/ {
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' $cors_origin always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'authorization, x-client-info, apikey, content-type, accept, accept-profile, content-profile, x-supabase-api-version, prefer, range' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 86400;
            add_header 'Content-Length' 0;
            return 204;
        }
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        proxy_pass http://postgrest:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # GoTrue (Auth) — mesmo padrão CORS
    location /auth/v1/ { ... }

    # Storage — mesmo padrão CORS
    location /storage/v1/ { ... }

    # Backend — mesmo padrão CORS
    location /functions/v1/ { ... }

    # Baileys — mesmo padrão CORS
    location /baileys/ { ... }
}
```

Cada location receberá o mesmo bloco de CORS headers com preflight OPTIONS handling. A origin será restrita ao `APP_DOMAIN` para segurança.

### Deploy

Após a alteração, na VPS:
```bash
git pull
docker compose up -d nginx
```

