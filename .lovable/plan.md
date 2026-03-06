

## GoTrue falha na migração: `auth.factor_type` não existe

O erro agora é diferente. O GoTrue roda suas migrações internas em sequência. A migração `20240729` tenta adicionar o valor `'phone'` ao enum `auth.factor_type`, mas esse tipo deveria ter sido criado por uma migração anterior. Isso indica que migrações anteriores falharam silenciosamente (provavelmente nas tentativas anteriores com o erro de SMTP, antes do volume ser limpo corretamente).

### Correção

Pré-criar no `deploy/init-db.sql` os tipos enum do schema `auth` que o GoTrue espera encontrar. Isso permite que as migrações posteriores (que fazem `ALTER TYPE ... ADD VALUE`) funcionem:

```sql
-- Tipos que GoTrue migrations precisam
DO $$
BEGIN
  CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE auth.code_challenge_method AS ENUM ('s256', 'plain');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token', 'reauthentication_token',
    'recovery_token', 'email_change_token_new',
    'email_change_token_current', 'phone_change_token'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;
```

Adicionar isso logo após os grants do schema `auth` no `init-db.sql`.

### Após aplicar

```bash
cd ~/simplificandoconversas/deploy
docker compose down -v
rm .env
bash install.sh
```

