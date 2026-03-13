

## Diagnóstico Final

### Dados coletados:

1. **"Eu creio"** (`138246440939651@lid`) - Mensagem REAL na Evolution API. Não é fantasma. O contato existe mas sem `phone_number` e sem `contact_name`.

2. **Contato +55 49 8846-5014** (`257239063498807@lid`) - Já existe no banco com **2 entradas duplicadas** (provavelmente de instâncias diferentes). `phone_number` é null em ambas. A última mensagem sincronizada é "Bom dia grupo..." e "[media]", não "Quero receber o Manuscrito".

3. **268 de 289 chats (93%)** são `@lid` sem `phone_number`. Todos aparecem como números sem sentido na interface.

### Problemas raiz:

| Problema | Causa |
|----------|-------|
| Contatos @lid sem telefone | `findChats` da Evolution não retorna phone para LIDs. O webhook só resolve via `senderPn`/`remoteJidAlt` (nem sempre presente) |
| Contato não aparece na lista | Ele está no banco, mas com `last_message` diferente do esperado. Pode estar "escondido" entre os 268 LIDs sem nome |
| Bug no fallback `lastMsgContent` | Quando `lastMessage` existe mas `message` é null (não descriptografada), retorna `"[media]"` em vez de placeholder |
| Mensagens inbound sem conteúdo | Inseridas com `content: null`, ficam invisíveis no chat |

---

## Plano de Correção

### 1. Fix do fallback `lastMsgContent` no sync-chats (linhas 358-361)

Verificar se `chat.lastMessage.message` existe antes de assumir `[media]`:
- Se `lastMessage` existe mas `message` é null/undefined → usar placeholder "Não foi possível visualizar a mensagem"
- Se `lastMessage.message` existe mas não tem texto → `[media]`

### 2. Fix de mensagens inbound sem conteúdo (linha 519)

Quando `msgContent` é null e `msgType` é "text" e não é `fromMe` → usar placeholder em vez de null.

### 3. Resolução de telefone para LIDs via `findContacts`

Adicionar uma etapa no `sync-chats` que tenta resolver o telefone de contatos @lid usando o endpoint `findContacts` da Evolution API. Para cada LID sem `phone_number`, buscar o número real e atualizar no banco.

### 4. Exibição melhorada de contatos @lid na interface

No `ConversationList.tsx`, quando o contato não tem `contact_name` nem `phone_number`, exibir o `remote_jid` de forma mais amigável (truncado) em vez do número LID bruto.

---

### Arquivos modificados:

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/whatsapp-proxy.ts` | Fix lastMsgContent fallback (L358-361), placeholder para mensagens sem conteúdo (L519), tentativa de resolução de phone via API |
| `src/components/conversations/ConversationList.tsx` | Display amigável para contatos @lid sem nome |

