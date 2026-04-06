

# Corrigir rastreamento de abertura/cliques e HTML do e-mail

## Problemas identificados

### 1. URLs de tracking apontam para endereço interno do Docker
No backend, `appUrl` é definido como `process.env.APP_PUBLIC_URL || supabaseUrl`. Como `APP_PUBLIC_URL` **não está configurado** no `docker-compose.yml`, ele cai no fallback `supabaseUrl` que é `http://nginx:80` — um endereço interno do Docker, inacessível pelo destinatário do e-mail.

Resultado: tanto o pixel de abertura quanto os links de clique apontam para `http://nginx:80/...`, que nunca é alcançado.

### 2. Pixel de abertura usa caminho errado
`injectTrackingPixel` gera URL com `/functions/v1/email/track/...`, mas no Nginx do APP_DOMAIN só existe proxy para `/api/email/`. Logo, mesmo com URL correta, o pixel retornaria 404 ou o index.html do SPA.

### 3. Inconsistência de caminhos
- Pixel: `/functions/v1/email/track/:id` (errado para APP_DOMAIN)
- Clique: `/api/email/click/:id` (correto para APP_DOMAIN)

## Solução

### 1. Adicionar `APP_PUBLIC_URL` ao docker-compose.yml
No serviço `backend`, adicionar a variável de ambiente:
```
APP_PUBLIC_URL: ${APP_URL}
```
Isso faz `appUrl` resolver para `https://app.seudominio.com` — acessível publicamente.

### 2. Corrigir caminho do tracking pixel
Em `deploy/backend/src/routes/email.ts`, alterar `injectTrackingPixel` para usar `/api/email/track/` em vez de `/functions/v1/email/track/`:
```
// DE:
const pixel = `<img src="${baseUrl}/functions/v1/email/track/${sendId}" ...`
// PARA:
const pixel = `<img src="${baseUrl}/api/email/track/${sendId}" ...`
```

### Arquivos alterados
- `deploy/docker-compose.yml` — adicionar `APP_PUBLIC_URL: ${APP_URL}` no backend
- `deploy/backend/src/routes/email.ts` — corrigir path do pixel de `/functions/v1/email/track/` para `/api/email/track/`

### Após o deploy
O usuário precisará rodar na VPS:
```bash
cd /root/simplificandoconversas/deploy && ./update.sh
```

Depois, qualquer e-mail enviado terá:
- Pixel: `https://app.seudominio.com/api/email/track/:sendId`
- Links: `https://app.seudominio.com/api/email/click/:clickId`

Ambos são proxied pelo Nginx do APP_DOMAIN para o backend.

