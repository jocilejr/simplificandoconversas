
# Plano: corrigir de vez o 400 em Respostas Rápidas na VPS

## Diagnóstico provável
Pelo código atual, o frontend insere em `quick_replies` estes campos:

```ts
{ title, content, category, user_id, workspace_id }
```

E o type gerado também espera:
- `category`
- `workspace_id`
- FK `fk_quick_replies_workspace`

Mas no seu bootstrap da VPS, o arquivo `deploy/init-db.sql` ainda cria `quick_replies` no formato antigo, só com:
- `id`
- `user_id`
- `title`
- `content`
- `created_at`

Então o erro persistente muito provavelmente é drift de schema na VPS:
- coluna `category` ausente ou não confirmada
- FK/índice/policies de `workspace_id` ausentes
- cache do PostgREST desatualizado
- policy antiga baseada só em `user_id`

## O que vou ajustar

### 1) Corrigir a tabela na VPS com SQL idempotente
Vou preparar um comando único, copiável, para rodar na VPS que faz:

- inspeciona schema real
- adiciona `category` se faltar
- garante `workspace_id`
- faz backfill correto de `workspace_id` sem o erro do `LATERAL`
- cria índice
- cria FK com `workspaces`
- remove policies antigas de `user_id`
- recria policies por `workspace_id`
- aplica `GRANT`
- roda `NOTIFY pgrst, 'reload schema'`

### 2) Corrigir a origem do problema no deploy
Vou ajustar `deploy/init-db.sql` para novas instalações da VPS já criarem `quick_replies` corretamente com:
- `workspace_id uuid not null`
- `category text not null default 'Geral'`
- índice de workspace
- FK para `workspaces`
- RLS compatível com workspace

Assim isso não volta em reinstalação ou bootstrap novo.

### 3) Melhorar o frontend para não mascarar o erro
Hoje a tela mostra só:
- “Erro ao criar resposta”

Vou alterar para mostrar a mensagem real retornada pela API/banco:
- `error.message`
- `error.details`
- `error.hint`

Isso acelera qualquer diagnóstico futuro na VPS.

### 4) Melhorar UX do modal
Hoje o modal fecha logo ao clicar em “Criar”, antes de confirmar sucesso.
Vou ajustar para:
- manter o modal aberto se falhar
- não limpar os campos em erro
- mostrar loading no botão
- corrigir o warning de `aria-describedby` com `DialogDescription`

## Comando de correção que será usado na VPS
```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quick_replies'
ORDER BY ordinal_position;

ALTER TABLE public.quick_replies ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Geral';
ALTER TABLE public.quick_replies ADD COLUMN IF NOT EXISTS workspace_id uuid;

UPDATE public.quick_replies qr
SET workspace_id = (
  SELECT wm.workspace_id
  FROM public.workspace_members wm
  WHERE wm.user_id = qr.user_id
  ORDER BY
    CASE wm.role
      WHEN 'admin' THEN 0
      WHEN 'operator' THEN 1
      ELSE 2
    END,
    wm.created_at
  LIMIT 1
)
WHERE qr.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_quick_replies_workspace ON public.quick_replies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_quick_replies_user ON public.quick_replies(user_id);

DO \$\$
BEGIN
  BEGIN
    ALTER TABLE public.quick_replies
      ADD CONSTRAINT fk_quick_replies_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END \$\$;

DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quick_replies'
      AND column_name = 'workspace_id'
      AND is_nullable = 'NO'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.quick_replies WHERE workspace_id IS NULL
  ) THEN
    ALTER TABLE public.quick_replies ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
END \$\$;

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ws_select ON public.quick_replies;
DROP POLICY IF EXISTS ws_insert ON public.quick_replies;
DROP POLICY IF EXISTS ws_update ON public.quick_replies;
DROP POLICY IF EXISTS ws_delete ON public.quick_replies;
DROP POLICY IF EXISTS \"Users can view own quick_replies\" ON public.quick_replies;
DROP POLICY IF EXISTS \"Users can insert own quick_replies\" ON public.quick_replies;
DROP POLICY IF EXISTS \"Users can update own quick_replies\" ON public.quick_replies;
DROP POLICY IF EXISTS \"Users can delete own quick_replies\" ON public.quick_replies;
DROP POLICY IF EXISTS \"Users can manage own quick replies\" ON public.quick_replies;

CREATE POLICY ws_select ON public.quick_replies
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY ws_insert ON public.quick_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_write_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY ws_update ON public.quick_replies
  FOR UPDATE TO authenticated
  USING (public.can_write_workspace(auth.uid(), workspace_id))
  WITH CHECK (public.can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY ws_delete ON public.quick_replies
  FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

GRANT ALL ON TABLE public.quick_replies TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
"
```

## Arquivos que serão alterados
- `deploy/init-db.sql`
- `src/hooks/useQuickReplies.ts`
- `src/pages/RespostasRapidas.tsx`
- `src/components/quick-replies/QuickRepliesList.tsx`

## Resultado esperado
Depois disso:
- o `POST /rest/v1/quick_replies` para de retornar `400`
- o modal não fecha quando falhar
- o toast mostra o erro real
- novas VPS já sobem com o schema correto de `quick_replies`
