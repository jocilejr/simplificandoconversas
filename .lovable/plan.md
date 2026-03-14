

## Plano: Seletor de Instancia no Popup da Extensao

### Problema
Atualmente, a extensao tenta detectar automaticamente a instancia via API (`detect-instance`), mas isso falha frequentemente. O usuario quer escolher manualmente a instancia na configuracao do popup.

### Solucao

**1. `chrome-extension/popup.html` + `chrome-extension/popup.js`**
- Apos login bem-sucedido, buscar as instancias ativas via `GET /api/ext/detect-instance` (ou um novo endpoint que retorne TODAS as instancias ativas)
- Exibir um `<select>` dropdown com as instancias conectadas
- Salvar a instancia selecionada em `chrome.storage.local` como `selectedInstance` (objeto com `instance_name`)
- Mostrar o select na secao "Conectado" (loggedSection)

**2. `chrome-extension/content.js`**
- No init, carregar `selectedInstance` do `chrome.storage.local` em vez de chamar `detectInstance()`
- Remover a funcao `detectInstance()` e a logica de retry
- O badge mostra o nome da instancia salva ou "Nao configurada"
- Se nao houver instancia configurada, mostrar aviso inline ao tentar disparar fluxo

**3. `deploy/backend/src/routes/extension-api.ts`**
- Alterar `/detect-instance` para retornar TODAS as instancias ativas (remover `.limit(1)`), renomear response para `instances[]`
- Manter retrocompatibilidade retornando tambem `instance` (primeira)

**4. `chrome-extension/background.js`**
- Adicionar action `list-instances` que chama `/api/ext/detect-instance` (que agora retorna todas)

### Fluxo do usuario
1. Abre popup → faz login
2. Apos login, ve dropdown "Selecione a instancia" com as instancias ativas
3. Escolhe uma → salva automaticamente
4. Sidebar usa essa instancia para todas as operacoes

### Arquivos alterados
1. `chrome-extension/popup.html` — adicionar select de instancia
2. `chrome-extension/popup.js` — fetch instancias apos login, salvar selecao
3. `chrome-extension/content.js` — ler instancia do storage, remover detectInstance
4. `chrome-extension/background.js` — action list-instances
5. `deploy/backend/src/routes/extension-api.ts` — retornar todas instancias

