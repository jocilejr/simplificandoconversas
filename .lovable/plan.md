

## Problema: GitHub ainda não tem as correções de código

O `git pull` trouxe apenas o arquivo `.lovable/plan.md` — os 4 arquivos com as correções de TypeScript e Dockerfile **não foram enviados**. O build continua falhando com os mesmos 16 erros.

Os arquivos estão corretos aqui no Lovable, mas o GitHub não os recebeu. Preciso fazer uma edição em cada arquivo para forçar o commit.

### Plano

Fazer uma edição mínima (adicionar comentário) nos 4 arquivos para forçar o Lovable a commitar e pushar ao GitHub:

| Arquivo | Estado no Lovable | Ação |
|---------|-------------------|------|
| `deploy/baileys-service/Dockerfile` | Correto (tem `git`) | Adicionar comentário para forçar push |
| `deploy/backend/src/routes/evolution-proxy.ts` | Correto (tem casts `any`) | Adicionar comentário para forçar push |
| `deploy/backend/src/routes/execute-flow.ts` | Correto (tem casts `any`) | Adicionar comentário para forçar push |
| `deploy/backend/src/routes/webhook.ts` | Correto (tem cast `any`) | Adicionar comentário para forçar push |

Após o push, rodar no servidor:
```bash
cd ~/simplificandoconversas
git pull origin main
cd deploy
docker compose build --no-cache && docker compose up -d
```

