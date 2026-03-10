

## Plano

A imagem correta para v2.3.7 é `evoapicloud/evolution-api:v2.3.7` (o publisher mudou de `atendai` para `evoapicloud`).

### Alteração

**`deploy/docker-compose.yml`** — linha da imagem do Evolution:
```yaml
# DE:
image: atendai/evolution-api:v2.2.3

# PARA:
image: evoapicloud/evolution-api:v2.3.7
```

### Deploy na VPS

```bash
cd ~/simplificandoconversas
git pull origin main
cd deploy
docker compose pull evolution
docker compose up -d evolution
# Aguardar ~30s, depois rebuild backend
docker compose up -d --build backend
```

