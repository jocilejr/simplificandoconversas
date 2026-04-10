

## Plano: Suporte dinâmico ao domínio de membros na infraestrutura

### Situação atual
O código frontend **já está correto** — `LinkGenerator.tsx` e `MemberClientCard.tsx` leem `delivery_settings.custom_domain` (que é definido em Configurações > Área de Membros > Domínio). Não há nada hardcodado no frontend.

O problema real é na **infraestrutura**: Traefik e nginx não reconhecem o domínio de membros. O Traefik só tem routers para `APP_DOMAIN` e `API_DOMAIN`.

### Alterações

**1. `deploy/docker-compose.yml`** — Adicionar variável `MEMBER_DOMAIN` e router Traefik

No serviço `nginx`, adicionar:
- Variável de ambiente `MEMBER_DOMAIN: ${MEMBER_DOMAIN:-}`
- Labels Traefik para o domínio de membros (condicionalmente via env var)

```yaml
labels:
  # ... labels existentes ...
  # Membros
  - "traefik.http.routers.chatbot-membros.rule=Host(`${MEMBER_DOMAIN}`)"
  - "traefik.http.routers.chatbot-membros.entrypoints=websecure"
  - "traefik.http.routers.chatbot-membros.tls.certresolver=letsencrypt"
```

**2. `deploy/portainer-stack.yml`** — Mesma alteração no bloco nginx

**3. `deploy/nginx/default.conf.template`** — Adicionar server block para o domínio de membros

Novo bloco que serve o frontend (SPA) no domínio de membros. Precisa servir os mesmos arquivos estáticos para que as rotas `/:phone` funcionem:

```nginx
# ─── Membros (MEMBER_DOMAIN) ───
server {
    listen 80;
    server_name ${MEMBER_DOMAIN};

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

**4. `deploy/.env.example`** — Adicionar `MEMBER_DOMAIN=`

### Deploy na VPS

Após fazer as alterações, na VPS:

```bash
# 1. Adicionar no .env
echo 'MEMBER_DOMAIN=membros.origemdavida.online' >> ~/simplificandoconversas/deploy/.env

# 2. Rebuild e restart
cd ~/simplificandoconversas && npm run build && rm -rf deploy/frontend/* && cp -r dist/* deploy/frontend/
cd deploy && docker compose up -d nginx

# 3. Verificar certificado (aguardar ~30s)
curl -I https://membros.origemdavida.online
```

O Traefik detecta a nova label, solicita certificado Let's Encrypt automaticamente e começa a rotear o domínio.

### Nota importante
Quando o usuário mudar o domínio em Configurações > Área de Membros, ele também precisará atualizar a variável `MEMBER_DOMAIN` no `.env` da VPS e reiniciar o nginx. Isso é uma limitação do Traefik com labels Docker — os domínios não podem ser 100% dinâmicos sem um file provider externo.

