

## Plano: Dois domínios separados (Frontend + API)

A arquitetura atual usa um único `APP_URL` para tudo. Vamos separar em dois domínios:
- **APP_DOMAIN** — frontend (ex: `app.seudominio.com`)
- **API_DOMAIN** — backend/API (ex: `api.seudominio.com`)

O frontend faz chamadas ao Supabase client usando `VITE_SUPABASE_URL`, que apontará para o domínio da API.

### Alterações

#### 1. `deploy/install.sh` — Solicitar dois domínios interativamente

Substituir a detecção automática de IP por prompts:
```bash
read -p "Domínio do Frontend (ex: app.seudominio.com): " APP_DOMAIN
read -p "Domínio da API (ex: api.seudominio.com): " API_DOMAIN
```

Gravar no `.env`:
- `APP_DOMAIN` e `API_DOMAIN` (sem protocolo)
- `APP_URL=https://${APP_DOMAIN}`
- `API_URL=https://${API_DOMAIN}`

O `.env.production` do build passa a usar:
```
VITE_SUPABASE_URL=https://${API_DOMAIN}
```

#### 2. `deploy/nginx/default.conf` — Dois server blocks

Converter para template (`default.conf.template`) com `envsubst`:

- **Server 1** (`APP_DOMAIN`): Serve o frontend estático (SPA)
- **Server 2** (`API_DOMAIN`): Proxies para PostgREST (`/rest/v1/`), GoTrue (`/auth/v1/`), Storage (`/storage/v1/`), Backend Express (`/functions/v1/`), Baileys (`/baileys/`)

#### 3. `deploy/docker-compose.yml`

- Passar `APP_DOMAIN` e `API_DOMAIN` como env vars do Nginx
- Usar `envsubst` no entrypoint do Nginx para gerar o conf final
- Atualizar GoTrue `API_EXTERNAL_URL` e `GOTRUE_SITE_URL` para usar as novas variáveis
- Remover portas expostas desnecessárias (3000, 5000, 9999, 8084, 3001) — tudo passa pelo Nginx
- Manter porta `80:80` no Nginx (o Nginx externo existente na VPS fará proxy para este)

#### 4. `deploy/update.sh`

Atualizar para usar `API_URL` no `VITE_SUPABASE_URL` do build.

#### 5. `deploy/.env.example`

Adicionar `APP_DOMAIN` e `API_DOMAIN`, remover `APP_URL` antigo.

#### 6. `deploy/portainer-stack.yml`

Alinhar com as mesmas variáveis de domínio.

### Fluxo de rede

```text
Internet → Nginx externo (porta 80/443 com SSL)
  ├─ app.dominio.com  → deploy-nginx:80 → frontend estático
  └─ api.dominio.com  → deploy-nginx:80 → postgrest/gotrue/storage/backend/baileys
```

### Arquivos modificados
- `deploy/install.sh`
- `deploy/update.sh`
- `deploy/nginx/default.conf` → `deploy/nginx/default.conf.template`
- `deploy/docker-compose.yml`
- `deploy/.env.example`
- `deploy/portainer-stack.yml`

