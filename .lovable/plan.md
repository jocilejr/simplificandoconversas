

## Problemas Identificados

### 1. `findChats` ainda retorna 0 contatos após filtro
Os logs mostram claramente:
```
[sync-chats] ads: findChats returned 21 chats
[sync-chats] ads: 0 individual contacts after filtering
```
O campo `remoteJid` **não existe** nos objetos retornados pelo `findChats` da Evolution v2. O debug anterior logava apenas as **keys** (`Object.keys`), mas não o conteúdo. O JID provavelmente está em outro campo (ex: `jid`, `chatId`, `name`, ou aninhado).

### 2. Conversa duplicada
Na screenshot, o contato `558981340810` aparece como entrada separada da `Terezinha Vilaça` (mesmo número `553788570517` não duplicou visualmente, mas `558981340810` aparece sem nome). Isso pode ser causado por JIDs com formatos diferentes (`@s.whatsapp.net` vs `@lid`) criados por webhook vs sync.

### Plano de Correção

**Arquivo:** `deploy/backend/src/routes/whatsapp-proxy.ts`

**1. Dump completo dos objetos findChats para descobrir o campo do JID**
Substituir o log de `Object.keys` por `JSON.stringify` dos primeiros 3 objetos completos (truncado a 500 chars cada). Isso revelará exatamente onde o JID está.

**2. Fallback robusto para extrair o JID**
Testar múltiplos campos possíveis na ordem:
```typescript
const jid = chat.remoteJid || chat.jid || chat.chatId || chat.owner || chat.id || "";
```

**3. Fix duplicatas — normalizar JID antes do upsert**
Se o mesmo contato chega como `@s.whatsapp.net` pelo webhook e como `@lid` pelo sync, cria duas conversations. Adicionar normalização ou, no mínimo, logar ambos os formatos para confirmar a causa.

**4. Adicionar action `debug-findchats`**
Criar uma action temporária que retorna o JSON bruto do `findChats` para o frontend, permitindo debug rápido sem precisar de logs do Docker.

### Resultado
Com o dump completo, identificaremos o campo correto do JID e faremos o sync funcionar para todos os 21 chats históricos. A normalização evitará duplicatas.

