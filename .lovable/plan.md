

## Problema: Fluxo ativo não aparece na sidebar do contato

### Causa Raiz

Dois problemas encontrados:

1. **Backend filtra status incompletos** — O endpoint `/contact-status` (linha 182) busca execuções ativas com `.in("status", ["running", "waiting"])`, mas ignora `waiting_click` e `waiting_reply`. O mesmo ocorre no dashboard (linha 40). Como o fluxo do screenshot está em `WAITING_CLICK`, ele não aparece como ativo.

2. **Sidebar não mostra esses status** — O `content.js` (linha 365) filtra `activeExecs` apenas por `running` e `waiting`, e os labels de status (linhas 372-373) não tratam `waiting_click`/`waiting_reply`.

### Correções

**1. `deploy/backend/src/routes/extension-api.ts`**
- Linha 40 (dashboard): adicionar `waiting_click` e `waiting_reply` ao filtro de execuções ativas
- Linha 182 (contact-status): adicionar `waiting_click` e `waiting_reply` ao filtro de execuções ativas

**2. `chrome-extension/content.js`**
- Linha 365: incluir `waiting_click` e `waiting_reply` no filtro `activeExecs`
- Linhas 372-373: adicionar labels para os novos status (`Aguardando Clique`, `Aguardando Resposta`)
- Linha 282 (dashboard recent): adicionar labels para `waiting_click` e `waiting_reply`

### Após deploy
```bash
docker compose build backend && docker compose up -d --force-recreate backend
```
E atualizar a extensão em `chrome://extensions`.

