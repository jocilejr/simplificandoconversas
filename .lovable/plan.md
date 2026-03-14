

## Fix: Erro "message_delay_ms not in schema cache"

### Problema
A coluna `message_delay_ms` existe no banco e no arquivo de tipos, mas o PostgREST (camada API) ainda não recarregou seu cache de schema. Isso causa o erro ao tentar fazer `.update({ message_delay_ms: ... })`.

### Solução
Criar uma migração "no-op" que força o reload do schema cache do PostgREST. Basta executar um `NOTIFY pgrst` que instrui o PostgREST a recarregar:

```sql
NOTIFY pgrst, 'reload schema';
```

Isso vai resolver o erro sem precisar alterar nenhum código.

### Arquivos impactados
- Nova migração SQL (apenas `NOTIFY pgrst`)

