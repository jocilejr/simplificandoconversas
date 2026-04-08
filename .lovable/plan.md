

# Fix: Tabela `followup_settings` não existe na VPS

## Causa raiz

A tabela `followup_settings` foi criada apenas nas migrations do Lovable Cloud (arquivo `20260407151222_...sql`). O script `update.sh` da VPS, que cria todas as tabelas via SQL inline, **nunca incluiu o `CREATE TABLE` para `followup_settings`**. Quando o `migrate-workspace.sql` roda, ele tenta adicionar `workspace_id` e RLS a uma tabela que não existe — mas usa `IF NOT EXISTS` em tudo, então falha silenciosamente.

## Solução

### Arquivo: `deploy/update.sh`

Adicionar o bloco `CREATE TABLE IF NOT EXISTS public.followup_settings` na seção de "base schema updates", **antes** do `migrate-workspace.sql`. A tabela precisa ter:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `workspace_id uuid NOT NULL UNIQUE` (UNIQUE é obrigatório para o upsert funcionar)
- `user_id uuid NOT NULL`
- `instance_name text`
- `enabled boolean NOT NULL DEFAULT false`
- `send_after_minutes integer NOT NULL DEFAULT 5`
- `send_at_hour text NOT NULL DEFAULT '09:00'`
- `max_messages_per_phone_per_day integer NOT NULL DEFAULT 1`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Incluir RLS + policies + GRANT, seguindo o padrão das outras tabelas no mesmo bloco.

### Resultado

Após o próximo `update.sh`:
1. A tabela será criada
2. O `migrate-workspace.sql` adicionará as policies de workspace
3. O frontend conseguirá fazer upsert sem erro

## Arquivos alterados
1. `deploy/update.sh` — Adicionar CREATE TABLE para followup_settings

