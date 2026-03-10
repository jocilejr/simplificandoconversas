

## Diagnóstico: Causa Raiz Encontrada

O papel `service_role` no banco de dados **não tem o atributo `BYPASSRLS`**. No `init-db.sql` linha 14:

```sql
CREATE ROLE service_role NOLOGIN;  -- FALTA BYPASSRLS!
```

Sem `BYPASSRLS`, mesmo com `GRANT ALL`, as policies RLS bloqueiam o acesso porque `auth.uid()` retorna `NULL` para o service client. Por isso:
- `sync-chats`: query retorna `[]` (RLS bloqueia)
- `delete-instance`: delete não remove nada (RLS bloqueia)
- Frontend funciona porque usa o token JWT do usuário (RLS passa com `auth.uid()`)

## Plano

### 1. Corrigir `deploy/init-db.sql` — adicionar BYPASSRLS ao service_role

Alterar a criação do role `service_role` (linha 14-16):

```sql
IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
END IF;
```

### 2. Corrigir banco existente na VPS

Como o banco já existe, o `CREATE ROLE IF NOT EXISTS` não vai re-executar. Adicionar um `ALTER ROLE` após o bloco DO (após linha 17):

```sql
ALTER ROLE service_role BYPASSRLS;
```

### 3. Deploy

Na VPS, executar manualmente no PostgreSQL para corrigir o banco existente:

```bash
docker compose exec postgres psql -U postgres -c "ALTER ROLE service_role BYPASSRLS;"
```

Depois reiniciar o backend:

```bash
docker compose restart backend
```

Isso resolve tanto o sync quanto o delete — o service client poderá ler e apagar registros ignorando RLS.

