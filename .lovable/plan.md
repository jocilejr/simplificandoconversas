

## Problema

O container GoTrue está reiniciando (`is restarting`) quando o script tenta criar o admin. O health check do GoTrue passou (via `wget`), mas o container caiu logo depois -- provavelmente porque o GoTrue não encontrou as tabelas necessárias do `auth` schema no banco de dados.

O `init-db.sql` cria `CREATE SCHEMA IF NOT EXISTS auth` mas **não cria as tabelas internas** que o GoTrue precisa (`auth.users`, `auth.refresh_tokens`, etc.). O GoTrue tenta fazer migrações automáticas, mas pode falhar ou reiniciar durante o processo.

### Correções

**1. `deploy/install.sh`** -- Aguardar GoTrue estabilizar e usar retry robusto

O problema é que o health check passa no primeiro boot, mas o GoTrue reinicia ao tentar as migrações. O script precisa:

- Aguardar mais tempo após o GoTrue responder (30s extra após health check)
- Fazer retry da criação do admin com loop (até 5 tentativas, 10s entre cada)
- Verificar que o container está `running` (não `restarting`) antes de tentar

```bash
# Esperar GoTrue estabilizar (migrações)
echo "  Aguardando GoTrue estabilizar..."
sleep 30

# Retry loop para criar admin
for attempt in {1..5}; do
  STATE=$(docker compose ps gotrue --format '{{.State}}' 2>/dev/null)
  if [ "$STATE" != "running" ]; then
    echo "  GoTrue não está running (estado: $STATE), aguardando..."
    sleep 10
    continue
  fi
  
  ADMIN_RESULT=$(docker compose exec -T gotrue wget -qO- ...)
  if echo "$ADMIN_RESULT" | grep -q '"id"'; then
    break
  fi
  sleep 10
done
```

**2. `deploy/docker-compose.yml`** -- Adicionar health check ao GoTrue

```yaml
gotrue:
  ...
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:9999/health"]
    interval: 5s
    timeout: 5s
    retries: 20
    start_period: 30s
```

E fazer o backend/nginx depender de `gotrue: condition: service_healthy`.

**3. `deploy/init-db.sql`** -- Remover `CREATE SCHEMA IF NOT EXISTS auth`

O GoTrue cria e gerencia o schema `auth` automaticamente. Criar o schema vazio antes pode confundir o GoTrue ao verificar migrações. Remover a linha para deixar o GoTrue criar tudo.

### Resultado

O instalador vai esperar o GoTrue completar as migrações e estabilizar antes de tentar criar a conta admin, com retry automático se falhar na primeira tentativa.

