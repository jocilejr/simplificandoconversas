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

## Extensão Chrome — Sidebar Profissional — Concluído ✅

### Redesign completo do overlay para sidebar fixa

| Arquivo | Descrição |
|---------|-----------|
| `chrome-extension/content.js` | Sidebar fixa 360px na direita. Duas abas: Dashboard (stats, execuções recentes) e Contato (tags, fluxos ativos, cross-instance, histórico). Detecção automática de instância. |
| `chrome-extension/styles.css` | Design escuro profissional (#111b21), cards com bordas arredondadas, tab bar com indicador verde, badges semânticos, scrollbar customizada |
| `chrome-extension/background.js` | Novas actions: `dashboard-stats`, `contact-cross`, `detect-instance`. Rotas atualizadas para `/api/ext/` |
| `deploy/backend/src/routes/extension-api.ts` | Novos endpoints: `GET /dashboard` (stats agregados), `GET /detect-instance` (instância ativa), `GET /contact-cross?phone=X` (conversas cross-instance). Contact-status agora retorna `history` (execuções completadas/canceladas). |

### Funcionalidades
- Sidebar fixa na direita, WhatsApp Web redimensionado automaticamente
- Dashboard com cards de resumo (fluxos ativos, contatos, execuções, instâncias)
- Lista de execuções recentes com nomes de fluxo e contato
- Aba Contato com header do contato, tags, fluxos ativos, cross-instance, disparar fluxo, histórico
- Detecção automática de instância (sem seletor manual)
- Toggle para abrir/fechar sidebar
- Polling a cada 8s para atualização

## Sistema Anti-Ban: Fila Global de Mensagens — Concluído ✅

### Implementação
| Arquivo | Mudança |
|---------|---------|
| **message-queue.ts** (novo) | Classe `MessageQueue` singleton por instância. Worker serial com 2s delay entre envios. Map global `instanceName → queue`. |
| **execute-flow.ts** | Todos os envios de mensagem (sendText, sendImage, sendAudio, sendVideo, sendFile, aiAgent, waitForClick) passam pela fila via `queue.enqueue()`. Nós de lógica (condition, action, waitDelay, trigger) continuam diretos. |
- Ícones SVG inline (sem emojis)
