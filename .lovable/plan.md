

## Causa raiz confirmada pelos logs

O erro é claro: `ERROR: schema "auth" does not exist (SQLSTATE 3F000)`.

A imagem `supabase/postgres:15.8.1.060` inicializa o schema `auth` (com tabelas, roles, extensões) apenas no banco de dados padrão **`postgres`**. Porém, o `docker-compose.yml` define `POSTGRES_DB: app`, criando um banco separado onde o `init-db.sql` roda. O GoTrue conecta nesse banco `app` e não encontra o schema `auth`.

## Correção

Trocar `POSTGRES_DB: app` para `POSTGRES_DB: postgres` e atualizar todas as connection strings de `/app` para `/postgres`.

### Arquivos alterados

**1. `deploy/docker-compose.yml`**
- Postgres: `POSTGRES_DB: postgres`
- GoTrue: `...@postgres:5432/postgres?sslmode=disable`
- PostgREST: `...@postgres:5432/postgres`
- Storage: `...@postgres:5432/postgres`
- Backend: `DATABASE_URL: ...@postgres:5432/postgres`

**2. `deploy/portainer-stack.yml`** — mesmas alterações.

**3. `deploy/init-db.sql`** — nenhuma alteração necessária (o script roda no banco definido por `POSTGRES_DB`).

### Após aplicar

```bash
cd ~/simplificandoconversas/deploy
docker compose down -v
rm .env
bash install.sh
```

