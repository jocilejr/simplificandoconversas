

## Diagnóstico

O log mostra: `findContacts returned 0 contacts`. O problema **não** é o `findChats` -- o `findContacts` também retorna vazio porque:

1. A documentação oficial da Evolution API mostra que `findContacts` requer o campo `where` no body (o código atual envia `{}` vazio)
2. Mesmo com `DATABASE_SAVE_DATA_CONTACTS: "true"`, se o container da Evolution não foi recriado (apenas restartado), a config pode não ter sido aplicada
3. Contatos só são salvos após interação -- numa instância nova, a tabela de contatos interna pode estar vazia

## Solução Real

Abandonar a dependência de `findContacts` e `findChats`. Usar `findMessages` diretamente SEM filtro de `remoteJid` para buscar TODAS as mensagens do banco interno da Evolution, e derivar os contatos a partir delas.

### Alteração: `deploy/backend/src/routes/whatsapp-proxy.ts` (case `sync-chats`)

Novo fluxo:

1. Para cada instância conectada (`open`), chamar `/chat/findMessages/{instance}` com body `{ where: {} }` (sem filtro) -- retorna todas as mensagens armazenadas
2. Agrupar mensagens por `remoteJid` (excluindo grupos, broadcast, newsletter)
3. Para cada `remoteJid` encontrado, criar/atualizar a conversation e inserir mensagens (dedup por `external_id`)
4. Log detalhado mostrando quantas mensagens e contatos foram encontrados

Isso elimina completamente a dependência dos endpoints bugados `findChats` e `findContacts`.

### Código resumido do novo sync-chats:

```typescript
// 1. Get ALL messages from Evolution internal DB
const allMessages = await evolutionRequest(
  `/chat/findMessages/${encodeURIComponent(instName)}`, "POST",
  { where: {} }
);

// 2. Group by remoteJid
const msgsByJid = new Map<string, any[]>();
for (const msg of messageList) {
  const jid = msg.key?.remoteJid;
  if (!jid || jid.includes("@g.us") || jid === "status@broadcast") continue;
  if (!msgsByJid.has(jid)) msgsByJid.set(jid, []);
  msgsByJid.get(jid)!.push(msg);
}

// 3. For each contact, upsert conversation + dedup insert messages
for (const [jid, msgs] of msgsByJid) {
  // upsert conversation, insert messages with external_id dedup
}
```

### Nenhuma alteração em outros arquivos

Os hooks de polling já estão corretos (2s/3s). O botão "Sincronizar" na UI já existe.

