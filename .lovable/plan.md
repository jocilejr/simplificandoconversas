

## Atualizar Extensão Chrome para Comunicação Dashboard ↔ WhatsApp

### Problema
A extensão atual NÃO tem um content script para a página do dashboard. O hook `useWhatsAppExtension.ts` envia `postMessage` com `source: "simplificando-app"`, mas ninguém escuta isso na página do dashboard. A extensão só injeta sidebar no WhatsApp Web.

O Finance Hub resolve isso com uma arquitetura de 3 camadas:
- `content-whatsapp.js` no WhatsApp Web (manipula DOM)
- `content-dashboard.js` no dashboard (ponte postMessage ↔ background)
- `background.js` roteia comandos entre as duas abas

### Plano

**1. Criar `chrome-extension/content-dashboard.js`** (NOVO)
- Content script que roda na página do dashboard (VPS domain + lovable domains)
- Escuta `window.postMessage` com tipos: `WHATSAPP_EXTENSION_PING`, `WHATSAPP_CHECK_CONNECTION`, `WHATSAPP_OPEN_CHAT`, `WHATSAPP_SEND_TEXT`, `WHATSAPP_SEND_IMAGE`, e também formatos bare (`OPEN_CHAT`, `SEND_TEXT`)
- Envia resposta `WHATSAPP_EXTENSION_READY` / `WHATSAPP_EXTENSION_LOADED` / `WHATSAPP_RESPONSE`
- Dedup de requests via `requestId`
- Baseado diretamente no `content-dashboard.js` do Finance Hub

**2. Criar `chrome-extension/content-whatsapp.js`** (NOVO)
- Content script que roda no WhatsApp Web para receber comandos DOM (OPEN_CHAT, SEND_TEXT, SEND_IMAGE)
- Funções: `openChat(phone)`, `prepareText(phone, text)`, `prepareImage(phone, imageDataUrl)`
- Manipulação do DOM: clicar "Nova conversa", digitar número, selecionar resultado, inserir texto
- Envia `WHATSAPP_READY` ao background a cada 5s
- Baseado no `content-whatsapp.js` do Finance Hub

**3. Reescrever `chrome-extension/background.js`**
- Manter TODA a lógica existente (apiCall, apiFetch, ensureFreshToken, doRefreshToken, handleMessage com contact-status, flows, trigger-flow, pause-flow, dashboard-stats, contact-cross, remove-tag, list-instances, validate-session, ai-status, ai-reply-toggle, ai-listen-toggle)
- ADICIONAR: gerenciamento de `whatsappTabId` e `dashboardTabId`
- ADICIONAR: roteamento de comandos `OPEN_CHAT`, `SEND_TEXT`, `SEND_IMAGE` do dashboard para o WhatsApp tab
- ADICIONAR: listener `WHATSAPP_READY` e `DASHBOARD_READY`
- ADICIONAR: `PING` para check de conexão WhatsApp
- ADICIONAR: `chrome.tabs.onRemoved` para limpar referências
- ADICIONAR: `findOrOpenWhatsApp()` que busca/abre tab do WhatsApp

**4. Atualizar `chrome-extension/manifest.json`**
- Substituir o content_scripts único por dois:
  - `content-whatsapp.js` em `https://web.whatsapp.com/*`
  - `content-dashboard.js` nos domínios do dashboard (VPS + lovable)
- Manter `content.js` (sidebar no WhatsApp) como estava
- Adicionar `host_permissions` para os domínios do dashboard

**5. Reescrever `src/hooks/useWhatsAppExtension.ts`**
- Trocar protocolo `simplificando-app`/`PONG` pelo protocolo multi-formato do Finance Hub
- Ping: `WHATSAPP_EXTENSION_PING`, resposta: `WHATSAPP_EXTENSION_READY`/`WHATSAPP_EXTENSION_LOADED`
- Envio de comandos com envelope multi-protocolo (primary `WHATSAPP_OPEN_CHAT`, fallback `WHATSAPP_EXTENSION_COMMAND`, fallback bare `OPEN_CHAT`)
- Resposta via `WHATSAPP_RESPONSE` com `requestId`
- Adicionar `sendImage`, `fallbackOpenWhatsApp`
- Normalizar telefone com prefixo `55`

### Resultado
A extensão no WhatsApp Web mantém a sidebar completa (dashboard, contato, fluxos, tags, IA) e GANHA a capacidade de receber comandos da aplicação web (abrir chat, enviar texto/imagem). A aplicação web detecta a extensão automaticamente e os botões de recuperação nas transações funcionam.

