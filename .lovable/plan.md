

## Plano: Adicionar coluna `granted_at` em `member_products`

### Causa raiz
O endpoint `member-access/:phone` faz `SELECT ... granted_at` na tabela `member_products`, mas essa coluna não existe na VPS.

### Correções

1. **`deploy/fix-member-tables.sql`** — adicionar `ALTER TABLE member_products ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ DEFAULT now();` junto aos outros ALTERs

2. **`deploy/init-db.sql`** — incluir `granted_at` na definição base de `member_products` para novos deploys

### Comando imediato na VPS
```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "ALTER TABLE member_products ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ DEFAULT now();"
docker compose -f ~/simplificandoconversas/deploy/docker-compose.yml restart backend
```

