

## Diagnóstico Confirmado

O Nginx renderizado mostra `server_name api.chatbotsimplificado.com nginx localhost;` -- a configuração está correta. Porém, o primeiro server block (frontend) é automaticamente o **default_server** do Nginx. Quando o backend envia `Host: nginx`, por algum motivo o Nginx está resolvendo para o bloco frontend e retornando `index.html`.

## Solução: Marcar o bloco API como `default_server`

Adicionar `default_server` no `listen` do bloco API garante que **qualquer request que não seja explicitamente para o APP_DOMAIN** vá para o bloco API. Isso é uma mudança de uma palavra, determinística, sem risco de quebrar o frontend.

### Alteração em `deploy/nginx/default.conf.template`

Linha 15, mudar de:
```
listen 80;
```
Para:
```
listen 80 default_server;
```

Nenhuma outra alteração necessária. O bloco frontend continua funcionando normalmente para requests com `Host: app.chatbotsimplificado.com`.

### Deploy
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose up -d --force-recreate nginx
docker compose logs backend --tail=10 -f
```

