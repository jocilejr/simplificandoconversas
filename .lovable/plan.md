

## Problema: `relation "identities" does not exist`

O GoTrue agora inicia, mas suas migrações internas não criaram as tabelas core (`auth.identities`, `auth.users`, etc.). A causa provável: o `init-db.sql` pré-cria os enum types do schema `auth` (`factor_type`, `factor_status`, etc.), e o sistema de migrações do GoTrue (baseado em `pop`) detecta que esses objetos já existem, fazendo com que migrações anteriores sejam marcadas como "já aplicadas" ou falhem silenciosamente -- pulando a criação das tabelas que viriam no mesmo arquivo de migração.

## Correção

**Remover TODOS os blocos `DO $$ CREATE TYPE auth.*` do `init-db.sql`**. Manter apenas:
- `CREATE SCHEMA IF NOT EXISTS auth;`
- Criação de roles (`supabase_auth_admin`, `supabase_admin`)
- Grants no schema `auth`

O GoTrue precisa rodar suas próprias migrações do zero, sem interferência. Ele criará os enums, tabelas (`users`, `identities`, `sessions`, `mfa_factors`, etc.) e índices internamente.

### Mudanças no `deploy/init-db.sql`

Remover as linhas 57-86 (os 5 blocos `DO $$ CREATE TYPE auth.factor_type/factor_status/aal_level/code_challenge_method/one_time_token_type`). Manter todo o resto inalterado.

### Após aplicar

```bash
cd ~/simplificandoconversas/deploy
docker compose down -v
rm .env
bash install.sh
```

Se o erro `factor_type does not exist` retornar na migração `20240729`, a alternativa será trocar a imagem `postgres:15-alpine` por `supabase/postgres:15.6.1.145` que já vem com todo o schema auth pré-configurado.

