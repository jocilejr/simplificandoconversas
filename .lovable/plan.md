

## Plano: Recriar os arquivos de deploy do backend

O problema é que o Lovable não está sincronizando as edições dos arquivos `deploy/` com o GitHub — só o `.lovable/plan.md` é enviado. A solução é **reescrever completamente** os 3 arquivos TypeScript e o Dockerfile para forçar o commit.

### Causa raiz dos erros de build

O `@types/node@22` faz `Response.json()` retornar `unknown`. Mesmo com `strict: false` no tsconfig, isso causa erros TS2339. Os arquivos no workspace do Lovable já têm os casts `any`, mas o GitHub nunca recebeu essas mudanças.

### Arquivos a reescrever completamente

| Arquivo | Correção |
|---------|----------|
| `deploy/baileys-service/Dockerfile` | Reescrever com `RUN apk add --no-cache git` |
| `deploy/backend/src/routes/evolution-proxy.ts` | Reescrever inteiro (já tem os casts `any` corretos) |
| `deploy/backend/src/routes/execute-flow.ts` | Reescrever inteiro (já tem os casts `any` corretos) |
| `deploy/backend/src/routes/webhook.ts` | Reescrever inteiro (já tem o cast `any` correto) |

### Abordagem

Vou usar `code--write` para reescrever cada arquivo por completo (não edição incremental), o que garante que o Lovable registre a mudança e faça push ao GitHub.

Após o push, rodar no servidor:
```bash
cd ~/simplificandoconversas && git pull origin main && cd deploy && docker compose build --no-cache && docker compose up -d
```

