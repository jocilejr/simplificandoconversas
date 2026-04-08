

# Fix: Erro ao salvar configurações do Follow Up

## Causa raiz

O hook usa `as any` desnecessariamente (a tabela `followup_settings` já existe nos tipos gerados). Além disso, o fluxo insert/update depende de `settings?.id` que pode estar desatualizado — se já existe um registro mas `settings` ainda não carregou, tenta INSERT e falha por UNIQUE constraint em `workspace_id`.

## Solução

### Arquivo: `src/hooks/useFollowUpSettings.ts`

1. **Remover todos os `as any`** — usar a tabela tipada diretamente: `.from("followup_settings")`
2. **Usar UPSERT nativo** — substituir a lógica condicional insert/update por `.upsert()` com `onConflict: "workspace_id"`, eliminando a race condition
3. **Incluir `workspace_id` e `user_id` no payload do upsert** para que funcione tanto como insert quanto update

### Arquivo: `src/components/followup/FollowUpSettingsDialog.tsx`

4. **Remover o cast `as any`** do `upsert.mutate()` — o tipo do payload agora bate com a interface

## Resultado
- Salvar sempre funciona (insert na primeira vez, update nas seguintes)
- Sem race condition entre query e mutation
- Tipos corretos sem casts

