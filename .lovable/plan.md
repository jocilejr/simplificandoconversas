

## Plano: Aceitar @lid no sync e migrar para telefone real via webhook

### Conceito
Salvar contatos `@lid` normalmente no banco durante o sync. Quando o webhook receber uma mensagem com `@lid` **e** conseguir resolver para telefone real (`senderPn`, `remoteJidAlt`, `participantAlt`), atualizar automaticamente o `remote_jid` da conversa e mensagens existentes.

### Alterações

**1. `deploy/backend/src/routes/whatsapp-proxy.ts` (sync-chats)**

Remover toda a lógica de resolução de `@lid` (linhas 348-398). Salvar o `rawJid` direto, seja `@s.whatsapp.net` ou `@lid`:

```typescript
// Remove lines 348-398 entirely. Just use rawJid directly:
const resolvedJid = rawJid;
const contactName = chat.name || chat.pushName || ...;
```

**2. `deploy/backend/src/routes/webhook.ts`**

Duas mudanças:

a) **Expandir resolução** (linhas 108-120) para incluir `senderPn` e `remoteJidAlt`:
```typescript
if (remoteJid && remoteJid.includes("@lid")) {
  const originalLid = remoteJid;
  const senderPn = key.senderPn || data.senderPn;
  if (senderPn) {
    remoteJid = `${senderPn}@s.whatsapp.net`;
  } else if (key.remoteJidAlt?.includes("@s.whatsapp.net")) {
    remoteJid = key.remoteJidAlt;
  } else if (key.participantAlt?.includes("@s.whatsapp.net")) {
    remoteJid = key.participantAlt;
  }
  // If resolved, migrate existing @lid conversations
  if (remoteJid !== originalLid) {
    // UPDATE conversations SET remote_jid = resolvedJid WHERE remote_jid = originalLid AND user_id/instance
    // UPDATE messages SET remote_jid = resolvedJid WHERE remote_jid = originalLid AND user_id
  }
}
```

b) **Remover o skip de @lid** (linhas 169-173). Se não resolveu, salvar com `@lid` mesmo -- será migrado quando chegar a primeira mensagem com dados de resolução.

### Resultado
- Sync importa todos os contatos imediatamente (com `@lid` se necessário)
- Primeira mensagem enviada/recebida com `senderPn` migra automaticamente o `@lid` para telefone real
- Contatos aparecem com nome (pushName) ou telefone real após migração
- Zero perda de dados

### Arquivos alterados
- `deploy/backend/src/routes/whatsapp-proxy.ts` -- simplificar sync removendo resolução
- `deploy/backend/src/routes/webhook.ts` -- expandir resolução + migração automática + remover skip

