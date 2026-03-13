

## Diagnóstico

O template `deploy/nginx/default.conf.template` no repositório **tem** o bloco `/r/` (linhas 7-15), mas o container Nginx na VPS **não tem**. Isso significa que o código no servidor está desatualizado — o `git pull` não foi feito antes do rebuild.

## Plano

### 1. Atualizar código na VPS e rebuild do Nginx

```bash
cd ~/simplificandoconversas
git pull
cd deploy
docker compose up -d --build nginx
```

### 2. Verificar que o config foi aplicado

```bash
docker exec deploy-nginx-1 cat /etc/nginx/conf.d/default.conf | grep -A5 "location /r/"
```

Deve mostrar o bloco com `rewrite ^/r/(.+)$ /api/link-redirect?code=$1 break;`.

### 3. Fallback de OG tags para bots (código)

Alterar `deploy/backend/src/routes/link-redirect.ts` para que bots **sempre** recebam HTML com OG tags, mesmo quando `preview_title/description/image` são null — usando `link.original_url` como fallback e adicionando `<meta http-equiv="refresh">` para redirect automático.

Mesma mudança em `supabase/functions/link-redirect/index.ts`.

**Antes (link-redirect.ts, linhas ~39-62):**
```typescript
if (link.preview_title || link.preview_description || link.preview_image) {
  // return OG HTML
}
return res.redirect(302, link.original_url);
```

**Depois:**
```typescript
// Always return OG HTML for bots
const title = link.preview_title || link.original_url;
const description = link.preview_description || "";
const image = link.preview_image || "";
const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}">
  ${image ? `<meta property="og:image" content="${image.replace(/"/g, '&quot;')}">` : ""}
  <meta property="og:url" content="${link.original_url}">
  <meta property="og:type" content="website">
  <meta http-equiv="refresh" content="2;url=${link.original_url}">
  <title>${title.replace(/</g, '&lt;')}</title>
</head><body></body></html>`;
return res.status(200).type("text/html").send(html);
```

### Resumo de arquivos a alterar
| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/link-redirect.ts` | Bots sempre recebem OG HTML (sem condicional) |
| `supabase/functions/link-redirect/index.ts` | Mesma mudança para paridade |

