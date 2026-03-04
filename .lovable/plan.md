

## Diagnóstico

O problema é que a tabela `conversations` tem um constraint de unicidade em `(user_id, remote_jid)`, sem incluir `instance_name`. Isso significa que se o mesmo contato (mesmo número de telefone) aparecer em duas instâncias diferentes, o upsert sobrescreve o `instance_name` com a última instância sincronizada.

Além disso, a API da Evolution pode estar retornando mensagens que pertencem ao mesmo servidor/número mas que o usuário considera de outra conta. Como não temos controle sobre o que a API retorna, precisamos:

1. Permitir que o usuário exclua conversas indesejadas manualmente
2. Corrigir o constraint de unicidade para incluir `instance_name`, evitando colisões entre instâncias

## Correções

### 1. Alterar o constraint de unicidade da tabela `conversations`

Atualmente: `UNIQUE (user_id, remote_jid)`
Novo: `UNIQUE (user_id, remote_jid, instance_name)`

Isso permite que o mesmo contato exista em instâncias diferentes sem sobrescrever dados.

**Migração SQL:**
- Dropar constraint antigo e criar o novo com `instance_name`
- Atualizar o `onConflict` no upsert de `"user_id,remote_jid"` para `"user_id,remote_jid,instance_name"`

### 2. Adicionar funcionalidade de excluir conversa

Permitir que o usuário delete conversas indesejadas via swipe ou botão de contexto na lista de conversas, para limpar dados incorretos vindos da API.

**Alterações:**
- Adicionar RLS policy para DELETE em `messages` (atualmente faltando)
- Adicionar botão/menu de contexto na `ConversationList` para excluir conversa
- Implementar função que deleta mensagens + conversa

### 3. Limpar conversas fantasma existentes

Executar migração para deletar as conversas que têm apenas mensagens de broadcast (a mesma mensagem "Oii meu bem...") sem interação real significativa.

### Arquivos a editar
- **Migração SQL**: alterar constraint + adicionar DELETE policy em messages
- `supabase/functions/evolution-proxy/index.ts`: atualizar `onConflict` para incluir `instance_name`
- `src/components/conversations/ConversationList.tsx`: adicionar opção de excluir conversa
- `src/hooks/useConversations.ts`: adicionar função `deleteConversation`

