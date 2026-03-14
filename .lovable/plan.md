
## Plano de correção (após seu `update.sh`)

### Leitura do cenário atual
- O backend já foi atualizado para validar token via `GET /user` (não usa mais `jwt.verify` local).
- Mesmo assim, o erro persiste porque ainda há dois pontos frágeis:
  1. **Sessão da extensão**: `background.js` usa `authToken` fixo, sem renovação automática e sem validação ao abrir.
  2. **Trigger interno**: em `extension-api.ts`, o endpoint `/api/ext/trigger-flow` chama `/api/execute-flow` **sem header Authorization**, o que pode retornar `Unauthorized` no fluxo interno.
- Também há uma inconsistência no `/dashboard`: falta `return` imediato após falha de auth.

### O que será implementado

1. **Sessão robusta da extensão (token lifecycle)**
   - Arquivo: `chrome-extension/background.js`
   - Adicionar `ensureFreshToken()` antes de qualquer `apiFetch`:
     - Ler `authToken` + `refreshToken` + `apiUrl`.
     - Decodificar `exp` do JWT.
     - Se estiver expirado (ou perto de expirar), chamar `POST /auth/v1/token?grant_type=refresh_token`.
     - Salvar novo `access_token` e `refresh_token`.
   - Adicionar retry único em `apiFetch` para 401:
     - tenta refresh
     - repete request 1 vez
     - se falhar, limpa sessão e retorna erro orientando relogin.

2. **Validação imediata no popup**
   - Arquivo: `chrome-extension/popup.js`
   - Ao abrir popup com token salvo:
     - validar sessão rapidamente (ou tentar refresh silencioso).
     - se inválida, forçar estado de login (não ficar “logado falso”).
   - Isso evita o caso “instalei agora mas já estava com token antigo no storage”.

3. **Correção do trigger no backend**
   - Arquivo: `deploy/backend/src/routes/extension-api.ts`
   - Em `/api/ext/trigger-flow`:
     - encaminhar `Authorization` original para `POST /api/execute-flow`.
     - se `execute-flow` retornar erro (`!ok`), **propagar status e mensagem reais** ao cliente (não mascarar).
   - Resultado: erro correto e execução real quando autorizado.

4. **Hardening de auth nas rotas ext**
   - Arquivo: `deploy/backend/src/routes/extension-api.ts`
   - Garantir `if (!userId) return;` em todas as rotas após `requireAuth` (incluindo dashboard), para evitar execução após 401.
   - Logs curtos de diagnóstico em falhas de auth (sem expor token).

### Arquivos impactados
- `chrome-extension/background.js`
- `chrome-extension/popup.js`
- `deploy/backend/src/routes/extension-api.ts`
- (Opcional de UX) `chrome-extension/content.js` para mensagem mais amigável quando sessão expira

### Fluxo final esperado
```text
[Popup login]
   -> salva access_token + refresh_token (+ exp)
[Usuário clica "Disparar fluxo" no WhatsApp]
   -> background ensureFreshToken()
   -> /api/ext/trigger-flow (Bearer válido)
   -> backend requireAuth via /user OK
   -> backend chama /api/execute-flow com Authorization encaminhado
   -> fluxo dispara com sucesso
```

### Validação pós-implementação
1. Login no popup e carregar instâncias.
2. Abrir contato no WhatsApp Web e disparar fluxo.
3. Simular expiração (token velho) e repetir:
   - deve renovar automaticamente sem pedir login imediato.
4. Se refresh inválido:
   - extensão deve deslogar e pedir novo login (erro claro, sem loop).
5. Confirmar que “Unauthorized” não aparece no disparo quando sessão está válida.

### Observação importante
- Os erros `503` vistos no preview web (`/functions/v1/whatsapp-proxy`) são de outro caminho (ambiente cloud/stub), não do endpoint da extensão (`/api/ext/*` na VPS). Este plano foca especificamente no problema real da extensão.
