

## Diagnóstico

O problema NÃO é código hardcoded. O `findChats` retornou 22 chats, mas o filtro atual aceita **apenas** `@s.whatsapp.net`. Dos 22 chats:
- ~19 são grupos (`@g.us`) -- corretamente excluídos
- 2-3 são contatos individuais com `@lid` -- **incorretamente excluídos pela última mudança**
- 1 é `@s.whatsapp.net` -- o único que passou

O WhatsApp agora usa internamente o formato `@lid` para contatos 1:1. Os `@lid` que descartamos na correção anterior **SÃO** contatos reais, não apenas membros de grupo.

Porém, mesmo trazendo `@lid` de volta, serão ~3 contatos, não os ~10+ que aparecem no WhatsApp. Isso porque a Evolution API só salva chats no banco dela durante a **conexão inicial**. Para importar o histórico completo, é necessário **reconectar a instância** (logout + novo QR code).

## Plano em 2 partes

### Parte 1: Corrigir o filtro de sync-chats

**Arquivo:** `deploy/backend/src/routes/whatsapp-proxy.ts`

Alterar o filtro para aceitar tanto `@s.whatsapp.net` quanto `@lid`, excluindo apenas grupos e broadcasts:

```typescript
const individualChats = chatList.filter((chat: any) => {
  const jid = extractJid(chat);
  if (!jid) return false;
  if (jid.includes("@g.us") || jid === "status@broadcast") return false;
  return jid.includes("@s.whatsapp.net") || jid.includes("@lid");
});
```

Adicionalmente, usar `findContacts` para construir um mapa `LID → telefone` antes do loop de sync:

```typescript
// Build LID→phone map from findContacts
const contactsResponse = await evolutionRequest(
  `/chat/findContacts/${encodeURIComponent(instName)}`, "POST", {}
);
const contactsList = Array.isArray(contactsResponse) ? contactsResponse : [];
const lidToPhone: Record<string, string> = {};
for (const c of contactsList) {
  const cJid = c.remoteJid || "";
  // Group participants often have participantAlt with real phone
  if (cJid.includes("@lid") && c.pushName) {
    // Store for potential matching later
  }
}
```

Porém, como os dados mostraram que `findContacts` não tem mapeamento LID→telefone, a abordagem será:
1. Aceitar `@lid` como JID válido no sync
2. No webhook, quando chegar `participantAlt` com `@s.whatsapp.net`, atualizar o `remote_jid` da conversa existente

### Parte 2: Webhook resolve `@lid` para telefone real

**Arquivo:** `deploy/backend/src/routes/webhook.ts`

Quando o webhook recebe uma mensagem com `participantAlt` contendo `@s.whatsapp.net`:
1. Verificar se existe conversa com o `@lid` original
2. Se existir, atualizar o `remote_jid` da conversa e das mensagens para o número real
3. Se não existir, criar nova conversa com o número real

Remover o skip de `@lid` que adicionamos na última mudança -- agora fazemos resolução em vez de descarte.

### Resultado esperado
- **Sync**: Importa todos os contatos individuais (tanto `@s.whatsapp.net` quanto `@lid`)
- **Webhook**: Resolve `@lid` para telefone real quando `participantAlt` estiver disponível, evitando duplicatas
- **Para mais contatos**: Usuário precisa reconectar a instância para forçar importação de histórico completo da Evolution API

### Arquivos alterados
- `deploy/backend/src/routes/whatsapp-proxy.ts` -- aceitar `@lid` no filtro, tentar resolução via findContacts
- `deploy/backend/src/routes/webhook.ts` -- resolver `@lid` → telefone via `participantAlt`, atualizar conversas existentes em vez de pular

