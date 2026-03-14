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

## Extensão Chrome — Overlay no WhatsApp Web — Concluído ✅

### Arquivos criados

| Arquivo | Descrição |
|---------|-----------|
| `chrome-extension/manifest.json` | Manifest V3 com content_scripts para WhatsApp Web |
| `chrome-extension/content.js` | Injeta overlay flutuante, detecta contato ativo via MutationObserver |
| `chrome-extension/background.js` | Service worker para chamadas autenticadas à API |
| `chrome-extension/popup.html` + `popup.js` | Configuração: URL da API + login (email/senha via GoTrue) |
| `chrome-extension/styles.css` | Estilos do painel overlay |
| `chrome-extension/icons/` | Ícones da extensão |
| `deploy/backend/src/routes/extension-api.ts` | Endpoints: flows, contact-status, trigger-flow, pause-flow |

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/index.ts` | Registrada rota `/api/ext` |
| `deploy/nginx/default.conf.template` | CORS dinâmico aceita `chrome-extension://` origins |

### Como instalar na VPS

1. `update.sh` para deploy dos novos arquivos backend
2. `docker compose up -d --force-recreate nginx` para aplicar CORS
3. No Chrome: `chrome://extensions` → Modo desenvolvedor → "Carregar sem compactação" → selecionar pasta `chrome-extension/`

### Funcionalidades

- Detecta contato aberto no WhatsApp Web automaticamente
- Mostra fluxos ativos do contato com status (running/waiting)
- Permite disparar qualquer fluxo ativo para o contato
- Permite parar/cancelar fluxos em execução
- Mostra tags do contato
- Polling a cada 5s para atualização em tempo real
- Autenticação via email/senha (mesmo login do app)
