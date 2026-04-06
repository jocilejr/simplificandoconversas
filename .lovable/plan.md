

# Corrigir erro 405 no webhook de e-mail

## Problema
O n8n está chamando `https://app.chatbotsimplificado.com/api/email/webhook/inbound` (POST), mas o Nginx do **APP_DOMAIN** não tem nenhuma regra para `/api/email/`. A requisição cai no `location /` que serve arquivos estáticos — o Nginx retorna **405 Method Not Allowed** porque tentou fazer POST num arquivo estático.

O backend Express tem a rota correta em `/api/email/webhook/inbound`, mas o Nginx do APP_DOMAIN não faz proxy dessa rota.

## Solução
Adicionar um bloco `location /api/email/` no server do **APP_DOMAIN** no Nginx, fazendo proxy para o backend Express — igual ao que já existe para `/api/external-messaging-webhook`.

### Arquivo: `deploy/nginx/default.conf.template`
Adicionar dentro do primeiro `server` block (APP_DOMAIN), antes do `location /`:

```nginx
# Email API (webhooks + tracking pixel)
location /api/email/ {
    proxy_pass http://backend:3001/api/email/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Após o deploy
Você precisará recriar o container do Nginx na VPS para aplicar a mudança:

```bash
cd /opt/simplifiq && docker compose up -d --force-recreate nginx
```

