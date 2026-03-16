

## Plano: Adicionar criação de tabelas AI no `update.sh`

### Problema
O `update.sh` só cria a tabela `meta_pixels` nas migrações. As tabelas `ai_config`, `ai_auto_reply_contacts` e `ai_listen_contacts` existem no `init-db.sql` mas não no `update.sh`, então atualizações em VPS existentes não as criam.

### Alteração
**Arquivo:** `deploy/update.sh` (bloco de migrações, linhas 48-71)

Adicionar ao bloco SQL existente (antes do `NOTIFY pgrst`):
- `CREATE TABLE IF NOT EXISTS public.ai_config` com constraint UNIQUE em `user_id`, RLS e policy
- `CREATE TABLE IF NOT EXISTS public.ai_auto_reply_contacts` com RLS e policy
- `CREATE TABLE IF NOT EXISTS public.ai_listen_contacts` com RLS e policy
- `CREATE TABLE IF NOT EXISTS public.reminders` com RLS e policy (se também faltar)

Tudo idempotente com `IF NOT EXISTS` e verificação de policy antes de criar.

### Impacto
- Zero risco para VPS que já tem as tabelas (tudo `IF NOT EXISTS`)
- Resolve definitivamente o problema para deploys futuros

