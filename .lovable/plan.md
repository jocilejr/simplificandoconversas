

# Fix: Workspace Creation Blocked by workspace_members RLS

## Problema raiz

O trigger `auto_add_workspace_creator` tenta inserir o criador como admin em `workspace_members`, mas a policy `wm_insert` exige que o usuário **já seja admin** do workspace — criando um paradoxo (chicken-and-egg).

## Solução

### 1. Alterar policy `wm_insert` em `workspace_members`

Permitir que um usuário insira a si mesmo OU que um admin do workspace insira outros:

```sql
DROP POLICY IF EXISTS "wm_insert" ON public.workspace_members;
CREATE POLICY "wm_insert" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()  -- pode inserir a si mesmo (trigger do workspace)
    OR
    has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role)  -- admin pode convidar
  );
```

### 2. Garantir BYPASSRLS para postgres (instrução para VPS)

Como segurança adicional, garantir que o role `postgres` tenha BYPASSRLS para que triggers SECURITY DEFINER funcionem sem restrição:

```sql
ALTER ROLE postgres BYPASSRLS;
```

### 3. Atualizar `deploy/migrate-workspace.sql`

Atualizar a definição da policy `wm_insert` no arquivo de migração para que futuros deploys já tenham a versão correta.

### Arquivos modificados

- `deploy/migrate-workspace.sql` — atualizar policy `wm_insert`
- Nova migração Supabase (Lovable Cloud) — mesma alteração de policy

### Instruções para VPS

```bash
cd ~/simplificandoconversas/deploy
docker compose exec -T postgres psql -U postgres -d postgres <<'SQL'
ALTER ROLE postgres BYPASSRLS;
DROP POLICY IF EXISTS "wm_insert" ON public.workspace_members;
CREATE POLICY "wm_insert" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role)
  );
NOTIFY pgrst, 'reload schema';
SQL
docker compose restart postgrest
```

