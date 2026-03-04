

## Problema

As conversas existentes no banco de dados possuem `instance_name = null` porque o `sync-chats` e o `send-message` no edge function `evolution-proxy` nunca preenchem esse campo. Quando o filtro e aplicado por instancia ("FunilPrincipal"), nenhuma conversa corresponde e a lista fica vazia.

## Solucao

### 1. Corrigir `evolution-proxy/index.ts` - Preencher `instance_name` nas conversas

- **sync-chats** (linha ~394-396): Adicionar `instance_name: evolution_instance_name` no objeto de upsert das conversas
- **send-message** (linha ~298-308): Adicionar `instance_name: evolution_instance_name` no upsert da conversa ao enviar mensagem

### 2. Backfill das conversas existentes

- Criar migration SQL que atualiza conversas com `instance_name IS NULL` usando o `evolution_instance_name` do profile do usuario:

```sql
UPDATE conversations c
SET instance_name = p.evolution_instance_name
FROM profiles p
WHERE c.user_id = p.user_id
  AND c.instance_name IS NULL
  AND p.evolution_instance_name IS NOT NULL;
```

### 3. Ajustar filtro no frontend

- Em `ConversationList.tsx`, quando uma instancia e selecionada, tambem incluir conversas com `instance_name` nulo (para nao perder conversas antigas nao tagueadas):

```typescript
const matchInstance = !selectedInstance || 
  c.instance_name === selectedInstance || 
  !c.instance_name;
```

Isso garante que conversas sem tag continuem visiveis independente do filtro selecionado, ate serem re-sincronizadas.

### Arquivos a editar
- `supabase/functions/evolution-proxy/index.ts` - sync-chats e send-message
- `src/components/conversations/ConversationList.tsx` - filtro
- Migration SQL para backfill

