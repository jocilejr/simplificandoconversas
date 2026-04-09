

# Fix: Dot de transações não aparece na VPS

## Causa raiz

A coluna `viewed_at` foi criada via migração no Lovable Cloud (`supabase/migrations/20260408234316_...sql`) mas nunca foi adicionada aos scripts de deploy da VPS (`deploy/init-db.sql` e `deploy/update.sh`). Sem essa coluna, a query do `useUnseenTransactions` falha silenciosamente, retornando contadores zerados.

Você acabou de adicionar a coluna manualmente. Agora precisamos garantir que ela esteja nos scripts para futuras atualizações.

## Alterações

### 1. `deploy/init-db.sql` — Adicionar `viewed_at` na definição da tabela `transactions`

Adicionar `viewed_at timestamptz DEFAULT NULL` na lista de colunas da tabela transactions (após `created_at`).

### 2. `deploy/update.sh` — Adicionar `viewed_at` na definição + ALTER TABLE

Mesma alteração na definição da tabela, e adicionar um `ALTER TABLE` idempotente logo após:
```sql
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ DEFAULT NULL;
```

### 3. Verificação pós-fix

Após o deploy, as novas transações que chegarem terão `viewed_at = NULL` e o dot verde aparecerá na sidebar e nas abas. Ao clicar na aba, o `markSeen` atualizará `viewed_at` e o dot sumirá.

**Importante:** Como você já marcou todas as transações existentes como vistas (`UPDATE transactions SET viewed_at = now()`), o dot só aparecerá para transações **novas** a partir de agora.

