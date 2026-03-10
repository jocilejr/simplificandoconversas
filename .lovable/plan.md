

## Fix: Evolution API "Database provider invalid"

O erro ocorre porque a Evolution API v2 exige `DATABASE_PROVIDER` mesmo com `DATABASE_ENABLED: "false"`. A variável está vazia, causando o crash.

### Correção no `deploy/docker-compose.yml` e `deploy/portainer-stack.yml`

Adicionar ao bloco `environment` do serviço `evolution`:

```yaml
DATABASE_PROVIDER: postgresql
DATABASE_CONNECTION_URI: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/postgres
DATABASE_SAVE_DATA_INSTANCE: "true"
DATABASE_SAVE_DATA_NEW_MESSAGE: "false"
DATABASE_SAVE_MESSAGE_UPDATE: "false"
DATABASE_SAVE_DATA_CONTACTS: "false"
DATABASE_SAVE_DATA_CHATS: "false"
DATABASE_SAVE_DATA_LABELS: "false"
DATABASE_SAVE_DATA_HISTORIC: "false"
```

Remover a linha `DATABASE_ENABLED: "false"`.

Isso conecta o Evolution ao mesmo Postgres do stack (necessário para persistir instâncias), mas desabilita o salvamento de mensagens/contatos (o app já gerencia isso via backend).

Também falta o container `backend`, `nginx` e `traefik` nos logs — provavelmente o `backend` falhou no build. Após aplicar a correção, rodar na VPS:

```bash
cd ~/simplificandoconversas/deploy
docker compose down
docker compose up -d --build
docker compose logs backend --tail=20
docker compose logs evolution --tail=20
```

