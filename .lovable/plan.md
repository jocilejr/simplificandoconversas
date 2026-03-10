

## Problemas Identificados e Correções

### Bugs encontrados nos logs:

1. **`is_active` resetado a cada `fetch-instances`** — O upsert na linha 109 sempre envia `is_active: false`, sobrescrevendo o valor `true`. Por isso o log mostra "Active instances found: 0" repetidamente, mesmo após setar como ativa. Ciclo infinito: upsert reseta → check encontra 0 → seta ativa → próximo fetch reseta de novo.

2. **`.single()` na query de instância ativa** (linha 88) — Causa erro PGRST116 quando 0 rows. Deve usar `.maybeSingle()`.

3. **`sync-chats` só retorna 1 contato** — A Evolution API retorna 35 mensagens via `findMessages` mas a maioria é de grupos (`@g.us`) que são filtrados. Os dados do `findChats` (que o diagnóstico mostrou ter todos os contatos) não são usados para popular conversas.

4. **`sync-chats` também reseta `is_active: false`** na linha 284 — Mesmo bug do fetch-instances.

5. **`findMessages` sem paginação** — Retorna apenas a primeira página (35 msgs). Não busca páginas seguintes.

### Plano de Correção

**Arquivo:** `deploy/backend/src/routes/whatsapp-proxy.ts`

**1. Fix `.single()` → `.maybeSingle()`** (linha 88)

**2. Fix upsert para NÃO sobrescrever `is_active`** (linhas 108-111 e 282-286)
- Remover `is_active` do payload do upsert
- Usar insert com `onConflict` ignorando `is_active`, ou fazer select + insert se não existe

**3. Reescrever `sync-chats` para usar `findChats` como fonte principal**
O endpoint `findChats` já retorna todos os contatos com `lastMessage`, `pushName`, `profilePicUrl`. Fluxo:
- Usar `findChats` para obter lista de todos os contatos/grupos
- Para cada contato (filtrar grupos opcionalmente), criar/atualizar conversation
- Usar `findMessages` com filtro por `remoteJid` específico + paginação para buscar mensagens de cada contato
- Dedup via `external_id` (já implementado)

**4. Adicionar paginação no `findMessages`**
```typescript
let page = 1;
let allMessages: any[] = [];
while (true) {
  const resp = await evolutionRequest(`/chat/findMessages/${instName}`, "POST", {
    where: { key: { remoteJid: jid } },
    page
  });
  const records = resp?.messages?.records || [];
  allMessages.push(...records);
  if (page >= (resp?.messages?.pages || 1)) break;
  page++;
}
```

### Resultado esperado
- Instância "ads" mantém `is_active: true` permanentemente
- Todas as conversas (contatos individuais) são sincronizadas
- Mensagens de cada contato são importadas com paginação completa
- Sem mais erros PGRST116 no log

