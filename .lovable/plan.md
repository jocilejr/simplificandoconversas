## Fix: @lid → phone_number resolution for Evolution API — Concluído ✅

### Root Cause
O `execute-flow` usava o `remoteJid` (@lid) diretamente como `number` nas chamadas à Evolution API. A Evolution API não aceita @lid — precisa de número real (@s.whatsapp.net).

### Mudanças realizadas

| Arquivo | Mudança |
|---------|---------|
| **execute-flow.ts (backend)** | Nova variável `sendNumber`: resolve phone_number da conversa quando jid é @lid. Usado em todas as chamadas Evolution API. `jid` mantido para operações no banco. |
| **execute-flow/index.ts (edge)** | Mesma lógica de resolução `sendNumber` para paridade |
| **webhook.ts** | `resolvedPhone` enviado no body ao disparar fluxos para que execute-flow tenha o telefone disponível |
| **executeStep()** | Novo parâmetro `sendNumber` para usar número real nas chamadas Evolution |

### Estratégia de resolução (3 camadas)
1. `bodyResolvedPhone` do webhook (mais rápido)
2. `phone_number` da conversa por `remote_jid` lookup
3. `phone_number` da conversa por `lid` lookup

## Fix: sync-chats fallbacks + LID phone resolution — Concluído ✅

### Mudanças realizadas

| Arquivo | Mudança |
|---------|---------|
| **whatsapp-proxy.ts** | Fix `lastMsgContent`: quando `lastMessage.message` é null (não descriptografada), usa placeholder em vez de `[media]`. Verifica `messageContextInfo` como única key para detectar mensagem vazia |
| **whatsapp-proxy.ts** | Fix mensagens inbound sem conteúdo: usa placeholder em vez de null para `msgType === "text"` |
| **whatsapp-proxy.ts** | Nova etapa `findContacts` no sync-chats: resolve `phone_number` e `contact_name` para conversas @lid sem telefone |
| **ConversationList.tsx** | Display amigável para @lid sem nome: mostra "Contato XXXX" (últimos 4 dígitos do LID) |
