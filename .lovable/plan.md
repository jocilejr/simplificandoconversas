

## Fix: Adicionar rota Nginx para `/api/payment/`

### Problema
O Nginx do API_DOMAIN não tem um `location` para `/api/payment/`. A requisição do n8n para `https://api.chatbotsimplificado.com/api/payment/webhook/boleto` retorna **404 Not Found** porque nenhum bloco intercepta esse caminho.

### Solução

Adicionar um bloco `location /api/payment/` no server do API_DOMAIN em `deploy/nginx/default.conf.template`, fazendo proxy para `http://backend:3001/api/payment/`.

### Workaround imediato (sem deploy)
Enquanto o deploy não é feito, a URL que já funciona via o catch-all `/functions/v1/` é:

```
https://api.chatbotsimplificado.com/functions/v1/payment/webhook/boleto
```

Use essa URL no n8n agora mesmo.

### Mudanças

| Arquivo | Acao |
|---------|------|
| `deploy/nginx/default.conf.template` | Adicionar `location /api/payment/` no bloco API_DOMAIN |
| `src/components/settings/IntegrationsSection.tsx` | Corrigir o `webhookPath` do Mercado Pago para usar `/functions/v1/payment/webhook/boleto` (compativel sem rebuild do Nginx) |

### Bloco Nginx a adicionar (após `/api/external-messaging-webhook`)

```nginx
location /api/payment/ {
    proxy_pass http://backend:3001/api/payment/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Após o deploy
Será necessário recriar o container Nginx na VPS para aplicar a nova regra:
```bash
docker compose up -d --force-recreate nginx
```

