

## GoTrue: schema "auth" ainda não existe

A imagem `supabase/postgres:15.8.1.060` **não** cria automaticamente o schema `auth` no banco `postgres` como esperado. O GoTrue tenta executar `CREATE TABLE IF NOT EXISTS auth.users` e falha com `schema "auth" does not exist`.

### Causa raiz

O GoTrue conecta como user `postgres` (superuser) e roda suas migrações internas. A primeira migração (`00_init_auth_schema.up.sql`) faz `CREATE TABLE IF NOT EXISTS auth.users` -- mas o schema `auth` precisa existir antes. O GoTrue **não cria o schema**, apenas as tabelas dentro dele.

### Correção

Adicionar de volta ao `deploy/init-db.sql` apenas o essencial que o GoTrue precisa para rodar suas migrações:

```sql
CREATE SCHEMA IF NOT EXISTS auth;
```

Isso é tudo. O GoTrue roda como user `postgres` (superuser via connection string), então tem permissões para criar tabelas no schema. As roles `supabase_auth_admin` e `supabase_admin` não são necessárias neste cenário.

### Arquivo alterado

**`deploy/init-db.sql`** -- adicionar `CREATE SCHEMA IF NOT EXISTS auth;` no início do arquivo, antes das roles PostgREST.

### Após aplicar

```bash
cd ~/simplificandoconversas/deploy
docker compose down -v
rm .env
bash install.sh
```

