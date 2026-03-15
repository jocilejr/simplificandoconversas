

## Problema

O comando de migration usa `$POSTGRES_USER` e `$POSTGRES_DB`, mas essas variáveis não existem no `.env` da VPS. O `.env` só define `POSTGRES_PASSWORD`. Sem valor, o `psql` tenta conectar como `root` e falha com "Peer authentication failed".

## Correção

No `deploy/update.sh`, substituir `$POSTGRES_USER` por `postgres` e `$POSTGRES_DB` por `postgres` (valores hardcoded, consistentes com `docker-compose.yml` e `install.sh`).

Linha 48 atual:
```bash
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'EOSQL'
```

Corrigir para:
```bash
docker compose exec -T postgres psql -U postgres -d postgres <<'EOSQL'
```

Uma mudança de uma linha. O resto do script permanece igual.

