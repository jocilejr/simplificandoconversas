
Objetivo: eliminar o erro intermitente **“API 504 / 504 Gateway Time-out”** na extensão e deixar o fluxo mais resiliente sob carga.

Diagnóstico (com base no que você enviou):
- Containers estão saudáveis e `/health` responde `ok`.
- Logs recentes não mostram queda do backend.
- O 504 aparece na extensão como HTML do Nginx, então o gargalo é de **tempo de resposta** em alguma rota `/api/ext/*` (mais provável em ações que disparam fluxo e esperam processamento).
- Há um ponto estrutural: a rota `POST /api/ext/trigger-flow` hoje aguarda `execute-flow` terminar; em fluxos maiores isso pode estourar timeout de proxy.

Plano de implementação:
1) Tornar `trigger-flow` assíncrono (resposta rápida)
- Arquivo: `deploy/backend/src/routes/extension-api.ts`
- Alterar `POST /api/ext/trigger-flow` para:
  - validar auth + payload + existência do fluxo;
  - iniciar execução em background (sem bloquear a resposta HTTP);
  - responder imediatamente `202 { ok: true, queued: true }`.
- Benefício: evita 504 mesmo com fluxos longos.

2) Ajustar timeout de proxy para rotas da extensão/funções
- Arquivo: `deploy/nginx/default.conf.template`
- Em `location /api/ext/` e `location /functions/v1/`:
  - adicionar `proxy_connect_timeout`, `proxy_send_timeout`, `proxy_read_timeout` maiores (ex.: 300s).
- Benefício: reduz timeout em operações legítimas mais lentas.

3) Melhorar robustez do polling da extensão
- Arquivo: `chrome-extension/content.js`
- Evitar chamadas concorrentes no polling (`loadDashboard/loadContactData`) com flags “in-flight”.
- Aplicar backoff após erro (ex.: 8s → 20s por alguns ciclos).
- Benefício: menos pressão no backend e menos chance de timeout em cascata.

4) Melhorar mensagem de erro no background
- Arquivo: `chrome-extension/background.js`
- Tratar resposta HTML de 502/504 e retornar erro amigável (sem dump bruto do HTML).
- Benefício: UX melhor e diagnóstico mais claro para o usuário final.

5) Observabilidade mínima para fechar o diagnóstico
- Arquivo: `deploy/backend/src/routes/extension-api.ts`
- Logar início/fim das rotas críticas com duração (ms) e status.
- Benefício: identificar exatamente qual endpoint estoura tempo.

Validação (fim a fim):
1. Rebuild/restart do backend + nginx.
2. Testar no WhatsApp Web:
   - abrir dashboard da extensão;
   - abrir contato;
   - disparar fluxo com delays;
   - pausar fluxo.
3. Confirmar:
   - sem popup “API 504”;
   - disparo retorna imediato;
   - execução aparece no painel como rodando/aguardando.
4. Conferir logs:
   - sem `upstream timed out`;
   - duração das rotas dentro do esperado.

Detalhes técnicos (resumo):
```text
Antes:
Extensão -> /api/ext/trigger-flow -> aguarda /api/execute-flow concluir -> pode estourar timeout -> 504

Depois:
Extensão -> /api/ext/trigger-flow -> 202 imediato (queued)
                                  \-> execução segue em background
Nginx com timeouts maiores em /api/ext e /functions/v1
Polling da extensão sem concorrência excessiva
```

Escopo de arquivos impactados:
- `deploy/backend/src/routes/extension-api.ts`
- `deploy/nginx/default.conf.template`
- `chrome-extension/content.js`
- `chrome-extension/background.js`
