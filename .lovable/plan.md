

## Remover tags de contato pela extensão Chrome

### O que será feito

1. **Novo endpoint no backend** (`deploy/backend/src/routes/extension-api.ts`)
   - `DELETE /api/ext/remove-tag` — recebe `{ remoteJid, tagName }`, deleta a tag do `contact_tags` filtrando por `user_id`, `remote_jid` e `tag_name`.

2. **Nova action no background** (`chrome-extension/background.js`)
   - Case `"remove-tag"` no `handleMessage` — chama `DELETE /api/ext/remove-tag` com body `{ remoteJid, tagName }`.

3. **UI na sidebar** (`chrome-extension/content.js`)
   - Cada tag ganha um botão "×" ao lado. Ao clicar, envia mensagem `remove-tag` ao background com o `remote_jid` do contato e o `tag_name`.
   - Após sucesso, recarrega os dados do contato para atualizar a lista.

### Arquivos impactados
- `deploy/backend/src/routes/extension-api.ts` — novo endpoint
- `chrome-extension/background.js` — novo case
- `chrome-extension/content.js` — botão × nas tags
- `chrome-extension/styles.css` — estilo do botão ×

### Após deploy
```bash
cd /opt/chatbot/deploy && docker compose build backend && docker compose up -d --force-recreate backend
```

