

## Diagnóstico: 3 problemas identificados

### 1. Webhook `set-webhook` falhando com erro 400
Nos logs: `"instance requires property \"webhook\""`. O payload está com estrutura errada. O `create-instance` usa `webhook: { url, byEvents, base64, events }` (nested), mas o `set-webhook` envia propriedades flat (`url`, `webhook_by_events`). A Evolution API espera a propriedade `webhook` como wrapper.

**Correção**: Alterar o body do `set-webhook` para usar a mesma estrutura nested do `create-instance`:
```typescript
body: JSON.stringify({
  webhook: {
    url: webhookUrl,
    byEvents: false,
    base64: true,
    events: [...]
  }
})
```

### 2. Conversas do FunilPrincipal aparecendo no filtro "Meire Rosana"
Conversas sem `instance_name` (salvas antes da feature multi-instância) passam no filtro porque a ConversationList aceita `!c.instance_name` como match para qualquer instância selecionada (linha 66). Essas conversas antigas não têm `instance_name` preenchido.

**Correção**: Quando o usuário seleciona uma instância específica, NÃO mostrar conversas sem `instance_name`. Alterar o filtro:
```typescript
const matchInstance = !selectedInstance || c.instance_name === selectedInstance;
```

### 3. Sync-chats e Webhook descartam JIDs `@lid`
- `sync-chats` (linha 475): filtra `@s.whatsapp.net`, descartando `@lid`
- `findChats` fallback (linha 443): mesmo filtro
- `evolution-webhook` (linha 158): descarta `@lid`

**Correção**: Aceitar `@lid` em todos os pontos, manter apenas filtro de grupos (`@g.us`) e status (`status@broadcast`).

### 4. Webhook busca usuário só pelo profile (instância ativa)
O `evolution-webhook` busca em `profiles.evolution_instance_name`, então mensagens de instâncias não-ativas são descartadas.

**Correção**: Buscar primeiro na tabela `evolution_instances`, depois pegar o profile pelo `user_id`.

---

### Arquivos a editar

1. **`supabase/functions/evolution-proxy/index.ts`**
   - Corrigir body do `set-webhook` (nested `webhook` property)
   - Aceitar `@lid` no sync-chats (linhas 443 e 475)

2. **`supabase/functions/evolution-webhook/index.ts`**
   - Buscar usuário via `evolution_instances` em vez de `profiles`
   - Remover filtro `@lid`

3. **`src/components/conversations/ConversationList.tsx`**
   - Remover fallback `!c.instance_name` do filtro de instância

