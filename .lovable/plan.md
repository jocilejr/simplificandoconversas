

## Problemas Identificados

1. **onConflict desatualizado em vários arquivos**: A migração alterou o constraint para `(user_id, remote_jid, instance_name)`, mas 5 locais ainda usam o antigo `"user_id,remote_jid"`:
   - `evolution-proxy/index.ts` linhas 387, 527
   - `evolution-webhook/index.ts` linhas 198, 229
   - `execute-flow/index.ts` linhas 65, 385, 445, 526

   Isso faz os upserts falharem silenciosamente ou não encontrarem o registro correto, causando conversas de outras instâncias "vazarem".

2. **Falta indicador de instância na lista de conversas**: O usuário quer ver a qual instância cada conversa pertence.

3. **Conversas de "FunilPrincipal" não aparecem**: Provavelmente porque os upserts com o onConflict errado falham ao inserir/atualizar essas conversas.

## Correções

### 1. Atualizar todos os onConflict para incluir instance_name

Em todos os arquivos que fazem upsert na tabela `conversations`, trocar `"user_id,remote_jid"` por `"user_id,remote_jid,instance_name"` e garantir que `instance_name` é passado no objeto de upsert.

**Arquivos:**
- `supabase/functions/evolution-proxy/index.ts` (linhas 387, 527)
- `supabase/functions/evolution-webhook/index.ts` (linhas 198, 229)
- `supabase/functions/execute-flow/index.ts` (linhas 65, 385, 445, 526)

### 2. Adicionar badge de instância na ConversationList

Abaixo do nome/número do contato, mostrar um pequeno badge/tag com o `instance_name` da conversa (ex: "Meire Rosana - Entregas" ou "FunilPrincipal") em texto discreto.

**Arquivo:** `src/components/conversations/ConversationList.tsx`

### 3. Re-sincronizar após deploy

Após as correções, o usuário deve sincronizar novamente para que as conversas de todas as instâncias sejam salvas corretamente com isolamento.

