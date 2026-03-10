

## Diagnóstico confirmado pelos dados reais

Os dados do `findContacts` mostram claramente:
- Contatos `@lid` são `type: "group_member"` com `isSaved: false` — **não são contatos reais**
- Contatos reais têm `@s.whatsapp.net` com `type: "contact"`
- Não existe mapeamento LID→telefone na API

## Plano: Simplificar sync + webhook

### 1. Limpar banco de dados (VPS)
Comandos para rodar na VPS:
```bash
docker compose exec postgres psql -U postgres -d postgres -c "DELETE FROM messages; DELETE FROM conversation_labels; DELETE FROM conversations;"
```

### 2. Simplificar `sync-chats` em `deploy/backend/src/routes/whatsapp-proxy.ts`

**Remover toda a lógica de resolução `@lid`** (`resolveToPhoneJid`). O filtro de chats individuais passa a aceitar **apenas** `@s.whatsapp.net`:

```typescript
// Filtro simplificado - só telefones reais
const individualChats = chatList.filter((chat: any) => {
  const jid = extractJid(chat);
  return jid.includes("@s.whatsapp.net") && jid !== "status@broadcast";
});
```

Remover a função `resolveToPhoneJid` e usar `extractJid` diretamente no loop. Remover os dumps de debug.

### 3. Ajustar webhook em `deploy/backend/src/routes/webhook.ts`

Para mensagens recebidas via webhook com `@lid` que não conseguem ser resolvidas: **pular a mensagem** em vez de salvar com o JID interno.

```typescript
// Se ainda é @lid depois de tentar resolver, pular
if (remoteJid.includes("@lid")) {
  console.log(`[webhook] Skipping unresolved @lid: ${remoteJid}`);
  return res.json({ ok: true, skipped: "unresolved_lid" });
}
```

### Resultado esperado
- **Sync**: Cria apenas conversas com números de telefone reais (`@s.whatsapp.net`)
- **Webhook mensagem nova**: Se o contato já existe (foi sincronizado), atualiza. Se é novo com `@s.whatsapp.net`, cria. Se é `@lid` não resolvido, ignora.
- **Zero duplicatas**: Sem `@lid` no banco, impossível duplicar

### Arquivos alterados
- `deploy/backend/src/routes/whatsapp-proxy.ts` — remover `resolveToPhoneJid`, filtrar apenas `@s.whatsapp.net`, remover dumps de debug
- `deploy/backend/src/routes/webhook.ts` — pular mensagens `@lid` não resolvidas

