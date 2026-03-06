

## Plano: Corrigir search_path do GoTrue

### Problema
As tabelas `auth.*` existem corretamente (20 tabelas), mas o GoTrue busca `identities` sem qualificar o schema. O `search_path` da conexão não inclui `auth`, então a query falha com `relation "identities" does not exist`.

### Solução
Adicionar a variável `GOTRUE_DB_NAMESPACE: auth` ao serviço `gotrue` no `docker-compose.yml` (e no `portainer-stack.yml`). Isso instrui o GoTrue a usar o schema `auth` para suas queries.

### Arquivos a alterar

**`deploy/docker-compose.yml`** — No serviço `gotrue`, adicionar:
```yaml
GOTRUE_DB_NAMESPACE: auth
```

**`deploy/portainer-stack.yml`** — Mesma alteração.

### Deploy
```bash
cd ~/simplificandoconversas/deploy
git pull
docker compose up -d gotrue
sleep 10
docker compose logs gotrue --tail 10
```

Não precisa `down -v` pois as tabelas já existem.

