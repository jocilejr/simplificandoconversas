

## Diagnóstico

A stack roda via **Docker Swarm** (Portainer), nomes reais: `simplificando_postgres`, `simplificando_backend`, etc. O `update.sh` usa `docker compose exec` que não funciona com Swarm — por isso `service "postgres" is not running`.

Também vejo:
- `simplificando_evolution` ainda rodando (precisa derrubar no cutover).
- `simplificando_redis` ainda rodando (idem).
- `baileys-server` (container antigo standalone) rodando — não é o nosso `baileys-gateway`.
- Não existe serviço `simplificando_baileys-gateway` ainda — Portainer não foi redeployado com o novo `portainer-stack.yml`.

## Plano

### 1. Tornar `update.sh` Swarm-aware

Detectar container real via `docker ps --filter name=...` e usar `docker exec` direto (não `docker compose exec`).

```bash
PG_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '_postgres\.|^postgres$' | grep -v supabase | head -n1)
```

Mesma lógica para `postgrest` (restart via `docker service update --force` em Swarm).

### 2. Adaptar fluxo de build/deploy para Swarm

`docker compose build` e `docker compose up -d` não funcionam em Swarm. Em Swarm o fluxo correto é:
- Build da imagem local: `docker build -t simplificando-backend:latest ./backend`
- Build da imagem do gateway: `docker build -t simplificando-baileys-gateway:latest ./baileys-gateway`
- Force update do serviço: `docker service update --force --image simplificando-backend:latest simplificando_backend`

Vou reescrever `update.sh` com detecção automática (Swarm vs Compose) e usar o caminho certo.

### 3. Atualizar `portainer-stack.yml` para incluir `baileys-gateway`

Confirmar que o stack file já tem o serviço (foi adicionado na Fase 1) — se sim, basta o usuário dar **Update Stack** no Portainer apontando pro Git atualizado.

### 4. Cutover Evolution → Baileys (comandos Swarm)

```bash
# Remover serviços antigos
docker service rm simplificando_evolution simplificando_redis

# Atualizar stack via Portainer (UI) OU via CLI:
docker stack deploy -c /opt/simplificandoconversas/deploy/portainer-stack.yml simplificando

# Drop DB evolution
docker exec $(docker ps -qf name=simplificando_postgres) psql -U postgres -c "DROP DATABASE IF EXISTS evolution;"

# Aplicar migrações SQL
cat init-db.sql migrate-workspace.sql fix-member-tables.sql \
  | docker exec -i $(docker ps -qf name=simplificando_postgres) psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

### 5. Remover container standalone `baileys-server`

```bash
docker stop baileys-server && docker rm baileys-server
```

## Arquivos a alterar

- `deploy/update.sh` — reescrita com detecção Swarm + uso de `docker exec` dinâmico + `docker service update --force` quando Swarm.

## Memória a criar

- `mem://tech/vps-swarm-deployment` — registrar que VPS usa Docker Swarm via Portainer, nomes `simplificando_*`, e fluxo de update correto.

## Próximos passos após implementar

1. Eu reescrevo `update.sh`.
2. Você roda na VPS:
   ```bash
   cd /opt/simplificandoconversas && git pull && bash deploy/update.sh
   ```
3. Pelo Portainer: **Stacks → simplificando → Pull and redeploy** (puxa o `portainer-stack.yml` atualizado com `baileys-gateway`).
4. Remove evolution/redis e o container órfão `baileys-server` (comandos acima).
5. Cada usuário recria instância em **Configurações → Conexões**.

## Risco

Baixo no script (defensivo). Médio no cutover (sessões caem, esperado).

