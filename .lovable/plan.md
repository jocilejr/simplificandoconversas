

## Diagnostico: Sidebar Nao Aparece Apos F5

### Causa Raiz

O problema tem duas camadas:

1. **`#app` existe imediatamente no HTML estatico do WhatsApp Web**, entao o `waitForApp` dispara antes do WhatsApp terminar de renderizar. O WhatsApp SPA reconstroi o DOM e pode destruir ou deslocar elementos injetados.

2. **O watchdog re-injeta a cada 3s**, mas o `createSidebar()` faz `document.body.appendChild(sidebar)` — se o WhatsApp manipular o body, o sidebar fica "enterrado" ou o `#app` nao recebe o atributo `data-sc-sidebar`.

3. **O `startObserver` e `startPolling` so sao chamados no `waitForApp` inicial**, mas nao no watchdog. Entao se o watchdog re-cria a sidebar, o polling e observer nao sao reiniciados.

### Correcoes

**`chrome-extension/content.js`**:

1. **Esperar pelo conteudo real do WhatsApp** — em vez de `#app` (que existe sempre), esperar por `#side` ou `div[data-testid="chat-list"]` que so aparecem quando o WhatsApp terminou de carregar
2. **Watchdog mais robusto** — alem de re-criar sidebar, reiniciar observer e polling
3. **Usar `document.body.appendChild` com verificacao** — garantir que o sidebar esta realmente visivel no DOM apos injecao
4. **Remover elementos orfaos** — antes de re-injetar, limpar toggle button antigo tambem

### Arquivos alterados
1. `chrome-extension/content.js` — corrigir waitForApp selector, robustecer watchdog

