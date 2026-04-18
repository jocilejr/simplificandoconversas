

## Diagnóstico

Olhando `useQuickReplies.ts` e `RespostasRapidas.tsx`:

**Problema:** Categorias só "existem" quando há pelo menos uma resposta usando aquele nome. A função `categories` é derivada de `data.map(d => d.category)`. Consequência:

1. Criar categoria nova pelo botão "+" da sidebar **não persiste nada** — só seleciona um nome em memória. Ao recarregar, sumiu.
2. Renomear categoria vazia falha silenciosamente — `UPDATE` em zero linhas.
3. Excluir a última resposta de uma categoria faz a categoria desaparecer da sidebar.
4. Categoria padrão "Geral" aparece no Select de criação mesmo que não exista no banco — confunde.

Não há tabela `quick_reply_categories`. A "categoria" é só um campo `text` em `quick_replies`.

## Solução

Criar tabela própria de categorias por workspace. Categorias passam a ser entidades reais — criar, renomear, excluir funcionam de forma persistente e independente das respostas.

### 1. Banco

Migration:
```sql
CREATE TABLE public.quick_reply_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

ALTER TABLE public.quick_reply_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.quick_reply_categories FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.quick_reply_categories FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.quick_reply_categories FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.quick_reply_categories FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- Seed: pegar categorias existentes em quick_replies por workspace
INSERT INTO public.quick_reply_categories (workspace_id, user_id, name)
SELECT DISTINCT workspace_id, user_id, category
FROM public.quick_replies
WHERE category IS NOT NULL AND category <> ''
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
```

Registrar a tabela em `deploy/migrate-workspace.sql` e nos arrays de tabelas multi-tenant (conforme `mem://tech/workspace-migration-registration`).

### 2. Frontend

**Novo hook `useQuickReplyCategories.ts`:**
- `list` — query da nova tabela ordenada por `name`
- `create({ name })` — insert (rejeita duplicado via unique constraint)
- `rename({ id, name })` — update na tabela + update em `quick_replies` no `category` antigo (transação lógica via 2 chamadas, com rollback de UI no erro)
- `remove({ id, name })` — bloqueia delete se existirem respostas usando essa categoria; senão delete

**`useQuickReplies.ts`:**
- Manter `renameCategory` mas passar a aceitar `oldName/newName` consistentes com o novo hook (já está OK).

**`RespostasRapidas.tsx`:**
- Trocar `categories` derivado por `useQuickReplyCategories().data`.
- `counts` continua derivado de `data` (respostas por nome).
- Passar callbacks `onCreateCategory`, `onDeleteCategory` para sidebar.

**`QuickRepliesSidebar.tsx`:**
- Botão "+" agora chama `onCreateCategory(name)` (persiste).
- DropdownMenu da categoria ganha item "Excluir" → chama `onDeleteCategory`. Se categoria tem respostas, toast de erro orientando mover/excluir antes.
- Renomear: chama `onRenameCategory` que renomeia tabela + atualiza `quick_replies`.

**`QuickRepliesList.tsx`:**
- `categories` recebido como prop continua. Remover fallback `["Geral"]` — se vazio, desabilitar botão "Nova Resposta" com tooltip "Crie uma categoria primeiro".

### 3. Fix do warning de ref

`QuickRepliesList` é function component sem `forwardRef`, mas Radix `Dialog` não exige ref no filho — o warning vem do uso interno. Não-bloqueante. Opcional: envolver em `forwardRef` se necessário, mas geralmente ignorável. Avaliar após mudanças principais.

## Validação na VPS

```bash
cd ~/simplificandoconversas && git pull && bash deploy/update.sh

docker exec deploy-postgres-1 psql -U postgres -d postgres -c "\d quick_reply_categories"

docker exec deploy-postgres-1 psql -U postgres -d postgres -c \
  "SELECT name, (SELECT COUNT(*) FROM quick_replies q WHERE q.workspace_id=c.workspace_id AND q.category=c.name) AS uso
   FROM quick_reply_categories c
   WHERE workspace_id='65698ec3-731a-436e-84cf-8997e4ed9b41'
   ORDER BY name;"
```

## Arquivos alterados

- Migration nova: `quick_reply_categories` + RLS + seed
- `deploy/migrate-workspace.sql` — registrar tabela
- `src/hooks/useQuickReplyCategories.ts` — novo
- `src/hooks/useQuickReplies.ts` — ajuste no `renameCategory`
- `src/pages/RespostasRapidas.tsx` — usar novo hook
- `src/components/quick-replies/QuickRepliesSidebar.tsx` — criar/excluir persistentes
- `src/components/quick-replies/QuickRepliesList.tsx` — desabilitar botão sem categorias

## Risco

Baixo. Tabela nova, seed preserva categorias atuais, RLS isolado por workspace.

