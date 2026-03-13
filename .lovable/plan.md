

## Correção: Mensagens não descriptografadas devem criar conversa e mostrar aviso

### Problema atual
Quando o WhatsApp não consegue descriptografar uma mensagem, o webhook recebe `data.message` vazio. Atualmente o conteúdo fica como `""` e o preview fica `"[text]"`, mas a conversa pode não aparecer corretamente.

### Solução

**Arquivo:** `deploy/backend/src/routes/webhook.ts`

Após extrair `messageContent` (linha ~208), detectar mensagens inbound vazias e substituir por um placeholder:

```typescript
// Após linha 208
const isEmptyInbound = !fromMe && !messageContent.trim() && messageType === "text";
const finalContent = isEmptyInbound 
  ? "Não foi possível visualizar a mensagem, abra seu smartphone para sincronizar" 
  : messageContent;
```

Usar `finalContent` em vez de `messageContent` no restante do código:
- Na variável `lastMessagePreview` (linha 219)
- No insert da mensagem (campo `content`, ~linha 305)

Isso garante que:
1. A conversa é criada/atualizada normalmente (contato aparece no chat)
2. A mensagem aparece com o aviso ao invés de ficar vazia
3. O fluxo não é disparado (já que `finalContent` não casa com keywords)

### Mudanças

| Local | Mudança |
|-------|---------|
| `webhook.ts` ~linha 208 | Detectar mensagem inbound vazia e substituir por placeholder |
| `webhook.ts` ~linha 219 | Usar `finalContent` no `lastMessagePreview` |
| `webhook.ts` ~linha 305 | Usar `finalContent` no insert da mensagem |

