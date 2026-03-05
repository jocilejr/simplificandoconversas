

## Bug: Mesmo contato não pode ter conversas em instâncias diferentes

### Causa raiz

Existe um **índice único antigo** `idx_conversations_user_jid` na tabela `conversations` com colunas `(user_id, remote_jid)` — **sem incluir `instance_name`**. Isso impede a criação de uma segunda conversa para o mesmo contato em outra instância, mesmo que o constraint mais novo `(user_id, remote_jid, instance_name)` permita.

Quando o webhook tenta fazer upsert com `onConflict: "user_id,remote_jid,instance_name"`, a operação INSERT subjacente viola o índice antigo `idx_conversations_user_jid`, causando o erro "Failed to upsert conversation" nos logs.

### Solução

Uma única migration SQL:

```sql
DROP INDEX IF EXISTS idx_conversations_user_jid;
```

Isso remove o índice antigo que bloqueia conversas multi-instância. O constraint `conversations_user_id_remote_jid_instance_key` (que inclui `instance_name`) permanece e garante a unicidade correta.

### Arquivos alterados
- Apenas uma migration SQL (nenhum arquivo de código precisa mudar)

