

## Bug: `sync-chats` retorna 0 contatos -- duas causas

### Causa 1: `chat.id` retorna o ID do banco, não o JID
Linha 331: `const id = chat.id || chat.remoteJid || ""`

O `findChats` da Evolution v2 retorna objetos onde `id` é o ID do Prisma (ex: `cmmkncock0007l14xrm3y3pht`), não o `remoteJid`. Como `chat.id` sempre existe, `chat.remoteJid` nunca é usado. O filtro `id.includes("@s.whatsapp.net")` falha em 100% dos casos.

### Causa 2: Contatos `@lid` são excluídos
A Evolution v2 usa o formato LID (`177266285932779@lid`) para alguns contatos individuais. O filtro atual só aceita `@s.whatsapp.net`.

### Correção em `deploy/backend/src/routes/whatsapp-proxy.ts`

**Linha 331**: Usar `chat.remoteJid` como fonte principal do JID, e aceitar tanto `@s.whatsapp.net` quanto `@lid`:

```typescript
const individualChats = chatList.filter((chat: any) => {
  const jid = chat.remoteJid || chat.id || "";
  return (jid.includes("@s.whatsapp.net") || jid.includes("@lid")) 
    && jid !== "status@broadcast";
});
```

**Linha 337**: Mesma correção na extração do JID:
```typescript
const jid = chat.remoteJid || chat.id;
```

Adicionar log dos primeiros chats para debug futuro.

