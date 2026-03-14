

## Plano: Extensao Chrome — Overlay no WhatsApp Web

### Conceito

Uma extensao Chrome que injeta um painel flutuante na interface do WhatsApp Web. Ela detecta o contato aberto, consulta o backend da VPS e exibe controles para gerenciar fluxos daquele contato em tempo real.

### Arquitetura

```text
WhatsApp Web (tab)
  └── Content Script (injetado)
        ├── Detecta contato aberto (phone/name do DOM)
        ├── Renderiza painel flutuante (overlay)
        └── Comunica com Background Script
              └── Fetch API → VPS Backend (API_DOMAIN)
                    ├── GET /api/ext/contact-status?phone=5511...
                    ├── POST /api/ext/trigger-flow
                    ├── POST /api/ext/pause-flow
                    └── GET /api/ext/flows (lista fluxos disponiveis)
```

### Estrutura de arquivos (nova pasta `chrome-extension/`)

```
chrome-extension/
├── manifest.json          # Manifest V3, permissions, content_scripts
├── content.js             # Injeta overlay no WhatsApp Web
├── background.js          # Service worker para chamadas API
├── popup.html             # Config (URL do backend, token)
├── popup.js               # Logica do popup de config
├── styles.css             # Estilo do painel overlay
└── icons/                 # Icones 16/48/128px
```

### Funcionalidades do Overlay

1. **Detectar contato aberto**: Content script observa o DOM do WhatsApp Web (MutationObserver) para extrair o numero/nome do contato ativo
2. **Painel flutuante**: Botao fixo no canto que expande um painel mostrando:
   - Status do contato (se tem fluxo ativo, qual fluxo, status)
   - Lista de fluxos disponiveis para disparar
   - Botao "Pausar fluxo" / "Parar fluxo"
   - Indicador de tags/etiquetas do contato
3. **Configuracao**: Popup para inserir URL do backend (API_DOMAIN) e token de autenticacao

### Mudancas no Backend (VPS)

**Novo arquivo: `deploy/backend/src/routes/extension-api.ts`**

Endpoints dedicados para a extensao, autenticados via token JWT do usuario:

- `GET /api/ext/flows` — Lista fluxos ativos do usuario
- `GET /api/ext/contact-status?phone=5511...` — Retorna execucoes ativas, tags, e info do contato
- `POST /api/ext/trigger-flow` — Dispara um fluxo para o contato (`{ flowId, phone, instanceName }`)
- `POST /api/ext/pause-flow` — Pausa/cancela execucao ativa (`{ executionId }`)

**`deploy/backend/src/index.ts`** — Registrar a nova rota

**`deploy/nginx/default.conf.template`** — Atualizar CORS para aceitar origem `chrome-extension://*`:
- Mudar `$cors_origin` para aceitar multiplas origens (APP_DOMAIN + chrome-extension)
- Ou usar `*` apenas nos endpoints `/api/ext/`

### Detalhes tecnicos

**Content Script (content.js)**:
- Usa `MutationObserver` para detectar mudancas no header do chat do WhatsApp Web
- Extrai o numero do contato do elemento `span[data-testid="conversation-info-header-chat-title"]` ou similar
- Cria um `div` flutuante com z-index alto para o painel
- Comunica com background.js via `chrome.runtime.sendMessage`

**Background Script (background.js)**:
- Recebe mensagens do content script
- Faz fetch para o backend com autenticacao
- Retorna dados ao content script
- Polling a cada 5s para status atualizado do contato aberto

**Autenticacao**:
- Usuario faz login no app web normalmente
- No popup da extensao, insere a URL do backend e faz login (email/senha)
- Token JWT armazenado em `chrome.storage.local`
- Enviado como `Authorization: Bearer <token>` em todas as chamadas

### Arquivos alterados/criados

**Novos (Chrome Extension)**:
- `chrome-extension/manifest.json`
- `chrome-extension/content.js`
- `chrome-extension/background.js`
- `chrome-extension/popup.html`
- `chrome-extension/popup.js`
- `chrome-extension/styles.css`

**Novos (Backend)**:
- `deploy/backend/src/routes/extension-api.ts`

**Alterados (Backend)**:
- `deploy/backend/src/index.ts` — registrar rota `/api/ext`
- `deploy/nginx/default.conf.template` — CORS para chrome-extension

