
Objetivo: corrigir o erro persistente ao criar workspace na VPS sem depender dos logs do Lovable Cloud.

Diagnóstico mais provável:
- As policies atuais da VPS já mostram `ws_insert = true` em `workspaces` e `wm_insert = user_id = auth.uid() OR admin`.
- O frontend cria o workspace com:
  `supabase.from("workspaces").insert(...).select().single()`
- Em ambiente self-hosted com PostgREST, esse `select().single()` faz o INSERT retornar a linha recém-criada via `RETURNING`, o que pode exigir passar imediatamente pela policy de `SELECT` de `workspaces`.
- A policy de `SELECT` em `workspaces` depende de `workspace_members`, mas a associação do criador é criada por trigger no mesmo fluxo. Em VPS isso pode falhar por ordem/visibilidade dentro da transação e o erro acaba aparecendo como violação RLS em `workspaces`.

Plano de implementação:
1. Ajustar o frontend para criar o workspace sem `select().single()`
- Arquivo: `src/components/WorkspaceSwitcher.tsx`
- Trocar o fluxo atual por:
  - `insert(...)` sem pedir retorno da linha
  - após sucesso, invalidar a query `["workspaces"]`
  - aguardar o refetch da lista
  - localizar o workspace recém-criado por `slug` ou `name+slug`
  - então chamar `setActiveWorkspace(...)`
- Isso evita depender do `SELECT` imediato na mesma operação que hoje pode estar disparando o erro.

2. Melhorar resiliência do fluxo de criação
- Manter estado de loading até o refetch terminar.
- Se o insert funcionar, mas o novo workspace ainda não aparecer no primeiro refetch, exibir mensagem mais clara:
  - “Workspace criado. Atualizando lista...”
- Se necessário, fazer um segundo refresh curto apenas da lista de workspaces, sem travar a UI inteira.

3. Preservar compatibilidade com o modelo atual
- Não alterar `useWorkspace.tsx` agora, porque ele já centraliza a lista e o workspace ativo.
- Reaproveitar a invalidação da query já existente.
- Não mexer no cliente gerado nem em autenticação.

4. Ajuste opcional de segurança/consistência no SQL de deploy
- Revisar `deploy/migrate-workspace.sql` para deixar `ws_insert` mais estrito:
  `WITH CHECK (created_by = auth.uid())`
- Isso não deve ser a causa principal do erro atual, mas melhora consistência.
- Só aplicar se não quebrar o fluxo do trigger na VPS.

Como validar na VPS depois da mudança:
1. Rebuildar e publicar o frontend na VPS com seu fluxo normal de deploy.
2. Fazer login normalmente.
3. Tentar criar um workspace novo.
4. Confirmar:
   - não aparece mais o toast de RLS
   - o workspace entra na lista
   - ele pode ser selecionado logo após criar

Se ainda persistir após essa mudança, a investigação seguinte dentro da VPS deve ser esta:
```bash
cd /root/simplificandoconversas/deploy

docker compose exec -T postgres psql -U postgres -d postgres <<'SQL'
SELECT
  pol.tablename,
  pol.policyname,
  pol.cmd,
  pol.qual,
  pol.with_check
FROM pg_policies pol
WHERE pol.schemaname = 'public'
  AND pol.tablename IN ('workspaces', 'workspace_members')
ORDER BY pol.tablename, pol.policyname;

SELECT
  tgname,
  tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.workspaces'::regclass
  AND NOT tgisinternal;

SELECT
  proname,
  prosecdef
FROM pg_proc
WHERE proname IN (
  'auto_add_workspace_creator',
  'get_user_workspace_ids',
  'has_workspace_role',
  'is_workspace_member'
)
ORDER BY proname;
SQL
```

Detalhes técnicos:
- `WorkspaceSwitcher.tsx` é hoje o ponto crítico.
- O problema não parece mais ser “policy errada”, e sim “fluxo do frontend exigindo retorno imediato da linha”.
- Em bancos com RLS, `INSERT ... RETURNING` pode falhar mesmo quando o `INSERT` em si seria permitido.
- Isso combina com o sintoma: mensagem de erro em `workspaces` apesar de `ws_insert` já estar liberada na VPS.
