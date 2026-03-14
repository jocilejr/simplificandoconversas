

## Correcao: 3 Problemas da Extensao Chrome

### Problema 1: Dashboard com erro (nao e Nginx)

Se a aba Contato funciona, o Nginx esta correto. O problema esta no endpoint `/api/ext/dashboard` que nao tem `try/catch` — qualquer erro no `Promise.all` retorna 500 sem resposta JSON, e o `background.js` interpreta como erro. Vou adicionar try/catch no endpoint e tambem melhorar o tratamento de erro no `content.js` com retry automatico.

**`deploy/backend/src/routes/extension-api.ts`** — Wrap do handler `/dashboard` em try/catch com resposta de erro JSON adequada.

**`chrome-extension/content.js`** — Dashboard com retry (1 tentativa apos 2s em caso de erro).

### Problema 2: Cross-instance mostrando propria instancia

O endpoint `contact-cross` retorna todas as conversas, incluindo da instancia atual. A extensao deve enviar o `excludeInstance` e o backend deve filtra-lo.

**`deploy/backend/src/routes/extension-api.ts`** — Aceitar query param `excludeInstance` e filtrar com `.neq("instance_name", excludeInstance)`.

**`chrome-extension/content.js`** — Ao chamar `contact-cross`, incluir `excludeInstance=${detectedInstance.instance_name}` na URL.

**`chrome-extension/background.js`** — Atualizar a action `contact-cross` para passar `excludeInstance` na query string.

### Problema 3: Design feio e desorganizado

Reescrita completa do CSS e da estrutura HTML gerada no `content.js`:

**`chrome-extension/styles.css`** — Polimento total:
- Espacamento mais generoso entre secoes (24px)
- Cards com sombra sutil e bordas mais suaves
- Stat cards com icone dentro (fundo colorido translucido)
- Tipografia com hierarquia mais clara (titulos maiores, labels menores)
- Secao "Fluxo Ativo" com borda lateral verde quando ativo
- Lista de fluxos para disparar com hover mais visivel
- Empty states com icone + texto centralizado
- Execucoes recentes com layout mais compacto

**`chrome-extension/content.js`** — Melhorias na renderizacao:
- Dashboard: icones nos stat cards, secao de resumo mais visual
- Contato: avatar com gradiente, secoes com separadores visuais claros
- Melhor tratamento de nomes longos (ellipsis)

### Arquivos alterados
1. `chrome-extension/content.js`
2. `chrome-extension/styles.css`
3. `chrome-extension/background.js`
4. `deploy/backend/src/routes/extension-api.ts`

### Apos deploy
```bash
docker compose build backend
docker compose up -d --force-recreate backend nginx
```

