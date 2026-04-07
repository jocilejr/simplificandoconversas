

# Corrigir webhook OpenPix — Retornar 200 na validação

## Problema
1. A URL do webhook (`https://app.chatbotsimplificado.com/functions/v1/payment-openpix/webhook`) usa o **APP_DOMAIN**, mas o proxy `/functions/v1/` só existe no bloco **API_DOMAIN** do Nginx. O APP_DOMAIN retorna o `index.html` do SPA em vez de encaminhar para o backend.
2. O endpoint só responde a `POST`. A OpenPix pode enviar um `GET` (ou `HEAD`) para validar que o endpoint retorna 200 antes de registrar.

## Alterações

### 1. Backend — Adicionar handler GET no webhook
**`deploy/backend/src/routes/payment-openpix.ts`**
- Adicionar `router.get("/webhook", ...)` que retorna `200 { ok: true }` para a validação da OpenPix

### 2. Nginx — Adicionar proxy no APP_DOMAIN para o webhook
**`deploy/nginx/default.conf.template`**
- Adicionar um bloco `location /functions/v1/payment-openpix/` no server do APP_DOMAIN que faz proxy para `http://backend:3001/api/payment-openpix/`
- Sem CORS restritivo (webhook externo), sem exigir autenticação

### 3. Frontend — Corrigir URL exibida (opcional)
Se o `app_public_url` do perfil apontar para o API_DOMAIN, a URL já estaria correta. Mas como o usuário configurou o APP_DOMAIN, o fix no Nginx resolve o problema diretamente.

## Pós-deploy (VPS)
```bash
docker compose up -d --build backend
docker compose restart nginx
```

Depois, testar novamente o registro do webhook na OpenPix.

