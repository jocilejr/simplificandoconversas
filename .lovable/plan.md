

## Diagnóstico

Nginx voltou (1/1 running, `nginx:alpine`, `index.html` montado). O 404 do `curl http://localhost` é só porque está batendo na porta 80 sem header `Host` — Traefik que roteia por domínio, então `curl` direto sem Host sempre dá 404. **A aplicação está OK agora.**

Resta consertar o `update.sh` para nunca mais quebrar o nginx tentando subir uma imagem `simplificando-nginx:latest` que não existe.

## Causa raiz

O loop atual em `deploy/update.sh` faz `docker service update --force --image simplificando-${svc}:latest` para todos os serviços, incluindo nginx. Mas nginx usa a imagem oficial `nginx:alpine` — não há build custom. Por isso o serviço foi rejeitado com "No such image".

## Fix

**`deploy/update.sh`** — separar nginx do loop:
- Loop de imagens custom: apenas `backend` e `baileys-gateway` → build local + `docker service update --force --image simplificando-{svc}:latest`
- Nginx tratado à parte: apenas `docker service update --force simplificando_nginx` (sem `--image`), para recarregar volumes (frontend `dist/` + template) mantendo `nginx:alpine`

Manter detecção Swarm vs Compose. Manter validação de build do frontend. Continuar sem migrations SQL.

## Verificação pós-fix

Comandos prontos para rodar na VPS depois do deploy:
```bash
docker service inspect simplificando_nginx --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
# deve continuar: nginx:alpine
docker service ls | grep simplificando
# todos 1/1
curl -sI -H "Host: SEU_APP_DOMAIN" http://localhost | head -3
# 200 OK ou 301
```

## Arquivo editado

- `deploy/update.sh`

