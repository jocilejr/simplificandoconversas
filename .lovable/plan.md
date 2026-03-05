

## URLs Configuráveis via Variáveis de Ambiente na Stack

### Conceito

Em vez de hardcodar `app.chatbotsimples.cloud` e `api.chatbotsimples.cloud`, usar variáveis de ambiente no `portainer-stack.yml` que o Portainer permite preencher na UI. Assim, para mudar de domínio basta editar as variáveis e redesploiar.

### Mudanças

1. **`deploy/portainer-stack.yml`** — Adicionar duas variáveis:
   - `APP_DOMAIN` (default: `app.chatbotsimples.cloud`) — domínio do frontend
   - `API_DOMAIN` (default: `api.chatbotsimples.cloud`) — domínio da API
   - Passar ambas para o container Nginx e Backend como env vars

2. **`deploy/nginx/default.conf`** — Converter para template (`default.conf.template`) que usa `${APP_DOMAIN}` e `${API_DOMAIN}` nos `server_name`. O Nginx Alpine suporta `envsubst` nativo via `/etc/nginx/templates/`.

3. **`deploy/portainer-stack.yml`** — No serviço Nginx, montar o template em `/etc/nginx/templates/default.conf.template` (o Nginx Alpine auto-processa com envsubst) e passar as env vars.

4. **`deploy/install.sh`** e **`deploy/update.sh`** — Usar `APP_DOMAIN` e `API_DOMAIN` do `.env` para gerar o `VITE_SUPABASE_URL` do frontend build.

5. **`deploy/PORTAINER.md`** — Atualizar tabela de variáveis com `APP_DOMAIN` e `API_DOMAIN`.

### Resultado no Portainer

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `APP_DOMAIN` | `app.chatbotsimples.cloud` | Domínio do frontend |
| `API_DOMAIN` | `api.chatbotsimples.cloud` | Domínio da API |
| `APP_URL` | `https://app.chatbotsimples.cloud` | URL completa (usada pelo GoTrue) |

Para mudar de domínio: edite as variáveis no Portainer → Redeploy. O Nginx recarrega automaticamente com os novos `server_name`.

**Nota:** O frontend precisa ser rebuildado ao mudar `API_DOMAIN` pois `VITE_SUPABASE_URL` é compilado no build. Os demais serviços atualizam sem rebuild.

