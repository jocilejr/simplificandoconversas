

## Plano: Corrigir inicialização do PostgreSQL

### Problema
A imagem `supabase/postgres:15.8.1.060` possui um `migrate.sh` interno que roda antes dos scripts customizados (numerados 98, 99). Esse script espera que roles como `supabase_admin` já existam, causando falha na inicialização.

### Solução

**1. Criar `deploy/init-roles.sh`**
Script shell numerado como `00` para rodar antes de tudo. Cria as roles internas que a imagem Supabase espera:
- `supabase_admin` (superuser)
- `supabase_auth_admin` (login, usado pelo GoTrue)

Ambas com senha `${POSTGRES_PASSWORD}`.

**2. Atualizar `deploy/docker-compose.yml` e `deploy/portainer-stack.yml`**
Montar o novo script como `/docker-entrypoint-initdb.d/00-init-roles.sh` no container postgres, garantindo execução antes do `migrate.sh` da imagem.

**3. Remover `deploy/init-auth-role.sh`**
Funcionalidade absorvida pelo novo `00-init-roles.sh`.

### Deploy
Após as alterações, na VPS:
```bash
docker compose down -v
docker compose up -d
sleep 30
docker compose logs postgres --tail 20
docker compose logs gotrue --tail 20
```

