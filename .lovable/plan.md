

# Plano: Criar tabela `quick_replies` na VPS

## Problema
A tabela `quick_replies` não existe no banco da VPS. O hook tenta fazer insert direto via Supabase client e falha.

## Solução

Execute na VPS:

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
CREATE TABLE IF NOT EXISTS public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  workspace_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'Geral'
);

CREATE INDEX IF NOT EXISTS idx_quick_replies_workspace ON public.quick_replies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_quick_replies_user ON public.quick_replies(user_id);

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY \"quick_replies_select\" ON public.quick_replies FOR SELECT USING (true);
CREATE POLICY \"quick_replies_insert\" ON public.quick_replies FOR INSERT WITH CHECK (true);
CREATE POLICY \"quick_replies_update\" ON public.quick_replies FOR UPDATE USING (true);
CREATE POLICY \"quick_replies_delete\" ON public.quick_replies FOR DELETE USING (true);

NOTIFY pgrst, 'reload schema';
"
```

Também registre a tabela no `migrate-workspace.sql` para futuros workspaces:

```bash
# Adicionar ao array de tabelas no migrate-workspace.sql
grep -q 'quick_replies' /root/simplificandoconversas/deploy/migrate-workspace.sql || echo "-- quick_replies já registrada"
```

## Nenhuma alteração de código necessária
O hook já está correto — só falta a tabela no banco da VPS.

