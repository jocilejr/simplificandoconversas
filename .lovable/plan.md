

## Problema

O console mostra: **"The 'Access-Control-Allow-Origin' header contains multiple values '*, https://app.chatbotsimplificado.com'"**. Isso acontece porque o GoTrue já envia `Access-Control-Allow-Origin: *` nas respostas, e o Nginx adiciona `https://app.chatbotsimplificado.com` por cima — resultando em dois valores, o que o browser rejeita.

## Solução

No `deploy/nginx/default.conf.template`, usar `proxy_hide_header` para remover os headers CORS que vêm do upstream (GoTrue, PostgREST, Storage, Backend) antes de adicionar os do Nginx. Isso garante que apenas um valor de `Access-Control-Allow-Origin` chegue ao browser.

### Alteração: `deploy/nginx/default.conf.template`

Em **cada location** do server API_DOMAIN, adicionar antes do `proxy_pass`:

```nginx
proxy_hide_header 'Access-Control-Allow-Origin';
proxy_hide_header 'Access-Control-Allow-Methods';
proxy_hide_header 'Access-Control-Allow-Headers';
proxy_hide_header 'Access-Control-Allow-Credentials';
```

Isso remove os headers CORS do upstream para que apenas os definidos pelo Nginx sejam enviados.

### Deploy

```bash
cd ~/simplificandoconversas/deploy
git pull
docker compose up -d --force-recreate nginx
```

